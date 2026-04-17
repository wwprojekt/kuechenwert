/**
 * Admin → Einstellungen → Tracking
 *
 * Zentrales Verwaltungs-UI für ALLE Tracking-Konfigurationen:
 * - Master-Toggle (alles an/aus)
 * - Google Analytics 4 (Measurement ID)
 * - Google Ads (Conversion ID + alle 9 Conversion-Labels + Werte)
 * - Google Tag Manager (Container ID)
 * - Meta Pixel (Pixel ID)
 * - Server-Side Google Ads (Customer ID, Login Customer ID, Action ID)
 * - Live-Status Card (was tatsächlich im Browser geladen ist)
 *
 * Die Werte werden in `site_settings.tracking_config` (JSONB) gespeichert.
 * Änderungen wirken via SettingsContext (realtime) sofort auf neu gefeuerte Events.
 * Skript-Tag-IDs (gtag.js, fbevents.js) werden über window.__TRACKING_BOOT__
 * (siehe index.html) bei Bedarf dynamisch nachgeladen.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ServerCog,
  Tag,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  DEFAULT_TRACKING_CONFIG,
  type ConversionLabelKey,
  type ConversionValueKey,
  type TrackingConfig,
} from "@/lib/trackingConfig";
import { supabase } from "@/integrations/supabase/client";

interface GadsDiagnosticAction {
  id: string;
  name: string;
  status: string;
  type: string;
  category: string;
  primary_for_goal: boolean;
}

interface GadsDiagnosticResponse {
  SALE_ENV_VALUE?: string | null;
  LENGTH?: number | null;
  FIRST_CHAR?: number | null;
  actions?: GadsDiagnosticAction[];
  error?: string;
}

type TrackingFormValue = Partial<TrackingConfig> | null | undefined;

interface AdminTrackingTabProps {
  /** Current value from formData.tracking_config (may be null on legacy rows). */
  value: TrackingFormValue;
  /** Updates formData.tracking_config (parent owns dirty-tracking + save button). */
  onChange: (next: TrackingConfig) => void;
}

const CONVERSION_KEYS: ConversionLabelKey[] = [
  "WIZARD_ABGESCHLOSSEN",
  "WERTRECHNER_LEAD",
  "WERTERMITTLUNG_LEAD",
  "KONTAKTFORMULAR_GESENDET",
  "TERMINBUCHUNG",
  "LANDING_PAGE_LEAD",
  "WIZARD_GESTARTET",
  "WIZARD_FAHRZEUGDATEN",
  "BEWERTUNG_ABGESCHLOSSEN",
];

const VALUE_KEYS: ConversionValueKey[] = [...CONVERSION_KEYS, "INSTANT_BUY"];

const CONVERSION_LABELS_DE: Record<ConversionValueKey, { title: string; subtitle: string; primary: boolean }> = {
  WIZARD_ABGESCHLOSSEN:    { title: "Wizard abgeschlossen",         subtitle: "Verkaufs-Wizard mit Kontaktdaten abgesendet",   primary: true  },
  WERTRECHNER_LEAD:        { title: "Wertrechner Lead",             subtitle: "/wertrechner Formular abgesendet",              primary: true  },
  WERTERMITTLUNG_LEAD:     { title: "Wertermittlung Lead",          subtitle: "/wertermittlung Formular abgesendet",           primary: true  },
  KONTAKTFORMULAR_GESENDET:{ title: "Kontaktformular gesendet",     subtitle: "/kontakt Formular abgesendet",                  primary: true  },
  TERMINBUCHUNG:           { title: "Terminbuchung",                subtitle: "Termin in Ankaufstation gebucht",               primary: true  },
  LANDING_PAGE_LEAD:       { title: "Landing Page Funnel",          subtitle: "Sekundär – Funnel-Einstieg ohne Kontaktdaten",  primary: false },
  WIZARD_GESTARTET:        { title: "Wizard gestartet",             subtitle: "Sekundär – Schritt 1 geladen",                  primary: false },
  WIZARD_FAHRZEUGDATEN:    { title: "Wizard Fahrzeugdaten",         subtitle: "Sekundär – Schritt 2 erreicht",                 primary: false },
  BEWERTUNG_ABGESCHLOSSEN: { title: "Bewertung abgeschlossen (Legacy)", subtitle: "DEPRECATED – wird nicht mehr gefeuert",     primary: false },
  INSTANT_BUY:             { title: "Sofortkauf (€-Wert)",          subtitle: "0 = Kaufpreis übernehmen, sonst fester Wert",   primary: false },
};

function ensureConfig(value: TrackingFormValue): TrackingConfig {
  if (!value || typeof value !== "object") return DEFAULT_TRACKING_CONFIG;
  const v = value as Partial<TrackingConfig>;
  const d = DEFAULT_TRACKING_CONFIG;
  return {
    enabled: v.enabled ?? d.enabled,
    ga4: { ...d.ga4, ...(v.ga4 ?? {}) },
    google_ads: {
      ...d.google_ads,
      ...(v.google_ads ?? {}),
      labels: { ...d.google_ads.labels, ...(v.google_ads?.labels ?? {}) },
      values: { ...d.google_ads.values, ...(v.google_ads?.values ?? {}) },
    },
    gtm: { ...d.gtm, ...(v.gtm ?? {}) },
    meta_pixel: { ...d.meta_pixel, ...(v.meta_pixel ?? {}) },
    server_side: { ...d.server_side, ...(v.server_side ?? {}) },
  };
}

function isValidGa4(id: string): boolean {
  return /^G-[A-Z0-9]{6,}$/.test(id.trim());
}
function isValidGads(id: string): boolean {
  return /^AW-\d{6,}$/.test(id.trim());
}
function isValidGtm(id: string): boolean {
  return id === "" || /^GTM-[A-Z0-9]{4,}$/.test(id.trim());
}
function isValidPixel(id: string): boolean {
  return /^\d{10,20}$/.test(id.trim());
}

interface LiveStatus {
  gtagLoaded: boolean;
  gtagId: string;
  fbqLoaded: boolean;
  fbqId: string;
  consentMode: boolean;
  configCacheRaw: string | null;
}

function readLiveStatus(): LiveStatus {
  if (typeof window === "undefined") {
    return { gtagLoaded: false, gtagId: "", fbqLoaded: false, fbqId: "", consentMode: false, configCacheRaw: null };
  }
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    __TRACKING_BOOT__?: { ga4?: string; gads?: string; fb?: string; loaded?: { ga4?: string; gads?: string; fb?: string } };
    dataLayer?: unknown[];
  };
  const boot = w.__TRACKING_BOOT__;
  return {
    gtagLoaded: typeof w.gtag === "function" && Array.isArray(w.dataLayer) && w.dataLayer.length > 0,
    gtagId: boot?.loaded?.ga4 || boot?.ga4 || "",
    fbqLoaded: typeof w.fbq === "function",
    fbqId: boot?.loaded?.fb || boot?.fb || "",
    consentMode: Array.isArray(w.dataLayer) && w.dataLayer.some((x) => Array.isArray(x) && x[0] === "consent"),
    configCacheRaw: (() => { try { return localStorage.getItem("tracking-config-cache"); } catch { return null; } })(),
  };
}

export default function AdminTrackingTab({ value, onChange }: AdminTrackingTabProps) {
  const cfg = ensureConfig(value);
  const [live, setLive] = useState<LiveStatus>(() => readLiveStatus());
  const [gadsDiag, setGadsDiag] = useState<GadsDiagnosticResponse | null>(null);
  const [gadsDiagLoading, setGadsDiagLoading] = useState(false);
  const [gadsDiagError, setGadsDiagError] = useState<string | null>(null);

  useEffect(() => {
    setLive(readLiveStatus());
    const t = window.setInterval(() => setLive(readLiveStatus()), 2000);
    return () => window.clearInterval(t);
  }, []);

  const runGadsDiagnostic = async () => {
    setGadsDiagLoading(true);
    setGadsDiagError(null);
    try {
      const { data, error } = await supabase.functions.invoke<GadsDiagnosticResponse>("gads-diagnostic", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) {
        setGadsDiagError(data.error);
        setGadsDiag(null);
      } else {
        setGadsDiag(data ?? null);
      }
    } catch (e: any) {
      setGadsDiagError(e?.message ?? String(e));
      setGadsDiag(null);
    } finally {
      setGadsDiagLoading(false);
    }
  };

  const update = (patch: Partial<TrackingConfig>) => onChange({ ...cfg, ...patch });
  const updateGa4 = (p: Partial<TrackingConfig["ga4"]>) => update({ ga4: { ...cfg.ga4, ...p } });
  const updateGads = (p: Partial<TrackingConfig["google_ads"]>) =>
    update({ google_ads: { ...cfg.google_ads, ...p } });
  const updateLabel = (key: ConversionLabelKey, label: string) =>
    updateGads({ labels: { ...cfg.google_ads.labels, [key]: label } });
  const updateValue = (key: ConversionValueKey, value: number) =>
    updateGads({ values: { ...cfg.google_ads.values, [key]: value } });
  const updateGtm = (p: Partial<TrackingConfig["gtm"]>) => update({ gtm: { ...cfg.gtm, ...p } });
  const updatePixel = (p: Partial<TrackingConfig["meta_pixel"]>) =>
    update({ meta_pixel: { ...cfg.meta_pixel, ...p } });
  const updateServer = (p: Partial<TrackingConfig["server_side"]>) =>
    update({ server_side: { ...cfg.server_side, ...p } });

  const ga4Valid = isValidGa4(cfg.ga4.measurement_id);
  const gadsValid = isValidGads(cfg.google_ads.conversion_id);
  const gtmValid = isValidGtm(cfg.gtm.container_id);
  const pixelValid = isValidPixel(cfg.meta_pixel.pixel_id);

  return (
    <div className="space-y-6">
      {/* Live-Status */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Live-Status (was JETZT im Browser geladen ist)
              </CardTitle>
              <CardDescription>
                Aktualisiert sich alle 2 Sekunden. Hier sehen Sie, welche Tracking-Skripte tatsächlich
                aktiv sind und mit welcher ID. Nutzen Sie das während des Google-Ads-Calls zur Verifikation.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setLive(readLiveStatus())}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Aktualisieren
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <LiveStatusItem
              label="gtag.js (GA4 + Ads)"
              ok={live.gtagLoaded}
              detail={live.gtagId || "noch nicht geladen"}
            />
            <LiveStatusItem
              label="Meta Pixel (fbq)"
              ok={live.fbqLoaded}
              detail={live.fbqId || "noch nicht geladen"}
            />
            <LiveStatusItem
              label="Google Consent Mode v2"
              ok={live.consentMode}
              detail={live.consentMode ? "aktiv" : "kein consent-Aufruf gefunden"}
            />
            <LiveStatusItem
              label="LocalStorage-Cache"
              ok={!!live.configCacheRaw}
              detail={live.configCacheRaw ? "geschrieben" : "leer"}
            />
          </div>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-amber-800 dark:text-amber-200">
                Änderungen an <strong>Conversion-Labels und €-Werten</strong> wirken
                sofort nach dem Speichern (alle Conversion-Events lesen die Werte
                live aus der DB). Änderungen an <strong>Skript-IDs</strong> (GA4-, Google-Ads-, Pixel- oder GTM-ID)
                werden zwischengespeichert und beim <strong>nächsten Page-Reload</strong> aktiv;
                ein „Skripte neu laden"-Button unten erzwingt das Nachladen ohne Reload.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Master-Schalter</CardTitle>
          <CardDescription>
            Globale Tracking-Aktivierung. Wenn AUS, wird gar nichts mehr getrackt
            (kein GA4, kein Google Ads, kein Meta Pixel) – unabhängig von den
            einzelnen Sektionen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Tracking aktiviert</Label>
              <p className="text-sm text-muted-foreground">
                {cfg.enabled ? "Alle aktivierten Tracker laufen." : "Tracking komplett deaktiviert."}
              </p>
            </div>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => update({ enabled: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Google Analytics 4 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Google Analytics 4
            {!ga4Valid && (
              <Badge variant="destructive" className="ml-2">Ungültig</Badge>
            )}
          </CardTitle>
          <CardDescription>
            GA4 Measurement Protocol – wird auch von der Edge Function <code>track-conversion</code> serverseitig genutzt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>GA4 aktiviert</Label>
              <p className="text-sm text-muted-foreground">Sendet PageViews und generate_lead Events</p>
            </div>
            <Switch checked={cfg.ga4.enabled} onCheckedChange={(v) => updateGa4({ enabled: v })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ga4-id">Measurement ID</Label>
            <Input
              id="ga4-id"
              value={cfg.ga4.measurement_id}
              onChange={(e) => updateGa4({ measurement_id: e.target.value })}
              placeholder="G-XXXXXXXXXX"
              className={!ga4Valid ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Format: <code>G-XXXXXXXXXX</code>. Aktuell: <strong>{cfg.ga4.measurement_id || "—"}</strong>
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Page Views automatisch senden</Label>
              <p className="text-sm text-muted-foreground">
                gtag-Konfiguration <code>send_page_view</code>. Aus = SPA muss PageViews manuell senden.
              </p>
            </div>
            <Switch checked={cfg.ga4.send_page_view} onCheckedChange={(v) => updateGa4({ send_page_view: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Google Ads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Google Ads
            {!gadsValid && (
              <Badge variant="destructive" className="ml-2">Ungültig</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Conversion-Tracking via gtag. Conversion-ID + Labels werden für jede
            getrackte Conversion gesendet als <code>send_to: AW-XXXX/LABEL</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Google Ads aktiviert</Label>
              <p className="text-sm text-muted-foreground">Conversion-Events feuern</p>
            </div>
            <Switch checked={cfg.google_ads.enabled} onCheckedChange={(v) => updateGads({ enabled: v })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gads-id">Conversion ID</Label>
            <Input
              id="gads-id"
              value={cfg.google_ads.conversion_id}
              onChange={(e) => updateGads({ conversion_id: e.target.value })}
              placeholder="AW-XXXXXXXXXX"
              className={!gadsValid ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Format: <code>AW-XXXXXXXXXX</code>. Aktuell: <strong>{cfg.google_ads.conversion_id || "—"}</strong>
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enhanced Conversions zulassen</Label>
              <p className="text-sm text-muted-foreground">
                Sendet gehashte E-Mail/Telefon mit – wichtig für Safari/ITP-Attribution.
              </p>
            </div>
            <Switch
              checked={cfg.google_ads.allow_enhanced_conversions}
              onCheckedChange={(v) => updateGads({ allow_enhanced_conversions: v })}
            />
          </div>

          {/* Conversion Labels Tabelle */}
          <div className="space-y-3 pt-4 border-t">
            <div>
              <h4 className="font-medium">Conversion-Labels</h4>
              <p className="text-sm text-muted-foreground">
                Jedes Event hat einen Label-String aus Google Ads. Format: ohne <code>AW-...</code> Präfix,
                nur der Teil nach dem Slash. Beispiel: <code>JO7oCPuNkY4cEL7FhpdD</code>
              </p>
            </div>
            <div className="space-y-2">
              {CONVERSION_KEYS.map((key) => {
                const meta = CONVERSION_LABELS_DE[key];
                return (
                  <div key={key} className="grid grid-cols-12 gap-2 items-center rounded-md border p-3">
                    <div className="col-span-12 md:col-span-5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{meta.title}</span>
                        {meta.primary ? (
                          <Badge variant="default" className="text-xs">PRIMÄR</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">SEKUNDÄR</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.subtitle}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">{key}</p>
                    </div>
                    <div className="col-span-12 md:col-span-7">
                      <Input
                        value={cfg.google_ads.labels[key] || ""}
                        onChange={(e) => updateLabel(key, e.target.value)}
                        placeholder="z.B. JO7oCPuNkY4cEL7FhpdD"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversion Werte */}
          <div className="space-y-3 pt-4 border-t">
            <div>
              <h4 className="font-medium">Conversion-Werte (€)</h4>
              <p className="text-sm text-muted-foreground">
                Smart Bidding nutzt diese Werte zur Optimierung. Höher = aggressiver geboten.
                Datenbasis: Wizard 41% Konversionsrate, Wertrechner 2%.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {VALUE_KEYS.map((key) => {
                const meta = CONVERSION_LABELS_DE[key];
                return (
                  <div key={`val-${key}`} className="space-y-1">
                    <Label htmlFor={`val-${key}`} className="text-xs">{meta.title}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`val-${key}`}
                        type="number"
                        step="0.5"
                        min="0"
                        value={cfg.google_ads.values[key] ?? 0}
                        onChange={(e) => updateValue(key, parseFloat(e.target.value || "0"))}
                        className="text-right"
                      />
                      <span className="text-sm text-muted-foreground">€</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Tag Manager */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Google Tag Manager
            {!gtmValid && cfg.gtm.container_id && (
              <Badge variant="destructive" className="ml-2">Ungültig</Badge>
            )}
            {!cfg.gtm.enabled && (
              <Badge variant="secondary" className="ml-2">Optional</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Optional. Aktuell nutzt CaravanWert direktes gtag.js statt GTM. Ein Container kann zusätzlich
            geladen werden, falls Sie GTM für Tag-Management einführen wollen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>GTM aktiviert</Label>
              <p className="text-sm text-muted-foreground">Lädt zusätzlich den GTM-Container</p>
            </div>
            <Switch checked={cfg.gtm.enabled} onCheckedChange={(v) => updateGtm({ enabled: v })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gtm-id">Container ID</Label>
            <Input
              id="gtm-id"
              value={cfg.gtm.container_id}
              onChange={(e) => updateGtm({ container_id: e.target.value })}
              placeholder="GTM-XXXXXXX (leer lassen wenn nicht genutzt)"
              className={cfg.gtm.container_id && !gtmValid ? "border-destructive" : ""}
            />
          </div>
        </CardContent>
      </Card>

      {/* Meta Pixel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Meta Pixel (Facebook/Instagram)
            {!pixelValid && (
              <Badge variant="destructive" className="ml-2">Ungültig</Badge>
            )}
          </CardTitle>
          <CardDescription>
            DSGVO-konform – wird erst aktiviert nach Marketing-Consent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Meta Pixel aktiviert</Label>
              <p className="text-sm text-muted-foreground">Standard- und Custom-Events feuern</p>
            </div>
            <Switch checked={cfg.meta_pixel.enabled} onCheckedChange={(v) => updatePixel({ enabled: v })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pixel-id">Pixel ID</Label>
            <Input
              id="pixel-id"
              value={cfg.meta_pixel.pixel_id}
              onChange={(e) => updatePixel({ pixel_id: e.target.value })}
              placeholder="1234567890123456 (rein numerisch)"
              className={!pixelValid ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Aktuell: <strong>{cfg.meta_pixel.pixel_id || "—"}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Google Ads Live-Diagnose (gads-diagnostic Edge Function) */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ServerCog className="w-5 h-5 text-primary" />
                Google Ads API – Live-Diagnose
              </CardTitle>
              <CardDescription>
                Ruft die Edge Function <code>gads-diagnostic</code> auf, prüft die Supabase-Secrets, fragt
                die Google-Ads-API live ab und listet alle aktuellen Conversion-Aktionen mit Status, Typ und
                Kategorie. Erspart das manuelle Abrufen via Konsole.
              </CardDescription>
            </div>
            <Button onClick={runGadsDiagnostic} disabled={gadsDiagLoading} size="sm">
              {gadsDiagLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Prüfe…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Live-Check ausführen
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!gadsDiag && !gadsDiagError && !gadsDiagLoading && (
            <p className="text-sm text-muted-foreground">
              Klicken Sie auf <strong>Live-Check ausführen</strong>, um die aktuelle Google-Ads-Konfiguration zu prüfen.
            </p>
          )}

          {gadsDiagError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Diagnose fehlgeschlagen.</strong>
                  <pre className="mt-1 text-xs whitespace-pre-wrap break-all">{gadsDiagError}</pre>
                  <p className="mt-1 text-xs">
                    Häufigste Ursache: ein Secret ist nicht gesetzt (z. B. <code>GADS_OAUTH_REFRESH_TOKEN</code>),
                    oder der Refresh-Token wurde widerrufen.
                  </p>
                </div>
              </div>
            </div>
          )}

          {gadsDiag && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <LiveStatusItem
                  label="OAuth + API erreichbar"
                  ok
                  detail={`${gadsDiag.actions?.length ?? 0} Conversion-Aktionen geladen`}
                />
                <LiveStatusItem
                  label="GADS_SALE_CONVERSION_ACTION_ID"
                  ok={!!gadsDiag.SALE_ENV_VALUE}
                  detail={gadsDiag.SALE_ENV_VALUE ?? "nicht gesetzt"}
                />
                <LiveStatusItem
                  label="Aktionen UPLOAD_CLICKS-fähig"
                  ok={(gadsDiag.actions ?? []).some((a) => a.type === "UPLOAD_CLICKS" && a.status === "ENABLED")}
                  detail={`${
                    (gadsDiag.actions ?? []).filter((a) => a.type === "UPLOAD_CLICKS" && a.status === "ENABLED").length
                  } aktiv`}
                />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Typ</th>
                      <th className="px-3 py-2 font-medium">Kategorie</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-center">Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(gadsDiag.actions ?? []).map((a) => {
                      const isSaleAction = a.id === gadsDiag.SALE_ENV_VALUE;
                      const isOfflineLead = a.id === cfg.server_side.gads_offline_conversion_action_id;
                      return (
                        <tr key={a.id} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">
                            {a.id}
                            {isSaleAction && <Badge variant="default" className="ml-2 text-[10px]">Sale-Action</Badge>}
                            {isOfflineLead && <Badge variant="secondary" className="ml-2 text-[10px]">Lead-Action</Badge>}
                          </td>
                          <td className="px-3 py-2">{a.name}</td>
                          <td className="px-3 py-2">
                            <Badge variant={a.type === "UPLOAD_CLICKS" ? "default" : "outline"} className="text-[10px]">
                              {a.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{a.category}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={a.status === "ENABLED" ? "default" : a.status === "REMOVED" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {a.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {a.primary_for_goal ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs">
                <div className="flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-amber-800 dark:text-amber-200">
                    Nur <strong>UPLOAD_CLICKS</strong>-Aktionen können per API hochgeladen werden (z. B. Lead-Conversions
                    aus <code>track-conversion</code> oder Sale-Conversions aus <code>close-auction</code>).
                    <strong> WEBPAGE</strong>-Aktionen werden direkt via gtag.js im Browser gefeuert.
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server-Side Google Ads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ServerCog className="w-5 h-5" />
            Server-Side Google Ads (Edge Function)
          </CardTitle>
          <CardDescription>
            Wird von der Edge Function <code>track-conversion</code> verwendet, um Offline-Conversions
            via Google Ads API hochzuladen. Geheime Tokens (OAuth Client Secret etc.) werden über Supabase Secrets verwaltet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gads-action">Offline Conversion Action ID</Label>
            <Input
              id="gads-action"
              value={cfg.server_side.gads_offline_conversion_action_id}
              onChange={(e) => updateServer({ gads_offline_conversion_action_id: e.target.value })}
              placeholder="z.B. 7576040066"
            />
            <p className="text-xs text-muted-foreground">
              Numerische ID aus Google Ads → Tools → Conversions → URL-Parameter
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gads-mcc">Login Customer ID (MCC)</Label>
            <Input
              id="gads-mcc"
              value={cfg.server_side.gads_login_customer_id}
              onChange={(e) => updateServer({ gads_login_customer_id: e.target.value })}
              placeholder="z.B. 9746508145 (ohne Bindestriche)"
            />
            <p className="text-xs text-muted-foreground">
              Falls das Konto über ein Verwaltungskonto (MCC) verbunden ist. Sonst leer lassen.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Aktionen */}
      <Card>
        <CardHeader>
          <CardTitle>Aktionen</CardTitle>
          <CardDescription>Manuelle Werkzeuge zur Verifikation und Steuerung.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              try { localStorage.removeItem("tracking-config-cache"); } catch { /* noop */ }
              setLive(readLiveStatus());
            }}
          >
            LocalStorage-Cache leeren
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent("tracking-config-updated", { detail: cfg }));
              } catch { /* noop */ }
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Skripte neu laden (mit aktueller Config)
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const cw = window as unknown as { gtag?: (...args: unknown[]) => void };
              if (typeof cw.gtag === "function") {
                cw.gtag("event", "admin_test_event", {
                  event_category: "Admin",
                  event_label: "test_from_admin_tracking_tab",
                  value: 1,
                });
                window.alert("Test-Event 'admin_test_event' an gtag gesendet. Prüfen Sie GA4 → Echtzeit.");
              } else {
                window.alert("gtag ist (noch) nicht geladen. Warten Sie 1-2 Sekunden und versuchen Sie es erneut.");
              }
            }}
          >
            Test-Event an GA4/Ads senden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LiveStatusItem({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{detail}</p>
    </div>
  );
}
