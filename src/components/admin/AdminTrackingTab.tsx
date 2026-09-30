/**
 * Admin → Einstellungen → Tracking
 *
 * Zentrales Verwaltungs-UI für ALLE Tracking-Konfigurationen:
 * - Master-Toggle (alles an/aus)
 * - Google Analytics 4 (Measurement ID)
 * - Google Ads (Conversion ID + Conversion-Labels + Werte)
 * - Google Tag Manager (Container ID)
 * - Meta Pixel (Pixel ID)
 * - Microsoft Ads (UET-Tag, Conversion-Ziele)
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
  RefreshCw,
  Tag,
  TrendingUp,
} from "lucide-react";
import {
  DEFAULT_TRACKING_CONFIG,
  type ConversionLabelKey,
  type TrackingConfig,
} from "@/lib/trackingConfig";
import GoogleAdsApiStatusCard from "./GoogleAdsApiStatusCard";
import LiveStatusItem from "./LiveStatusItem";

type TrackingFormValue = Partial<TrackingConfig> | null | undefined;

interface AdminTrackingTabProps {
  /** Current value from formData.tracking_config (may be null on legacy rows). */
  value: TrackingFormValue;
  /** Updates formData.tracking_config (parent owns dirty-tracking + save button). */
  onChange: (next: TrackingConfig) => void;
}

const CONVERSION_KEYS: ConversionLabelKey[] = ["KUECHEN_LEAD", "KONTAKTFORMULAR_GESENDET"];

const CONVERSION_LABELS_DE: Record<ConversionLabelKey, { title: string; subtitle: string; primary: boolean }> = {
  KUECHEN_LEAD:            { title: "Küchenanfrage",                subtitle: "Funnel A, B oder C mit Kontaktdaten abgesendet", primary: true  },
  KONTAKTFORMULAR_GESENDET:{ title: "Kontaktformular gesendet",     subtitle: "/kontakt Formular abgesendet",                  primary: true  },
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
    microsoft_ads: {
      ...d.microsoft_ads,
      ...(v.microsoft_ads ?? {}),
      conversion_goals: { ...d.microsoft_ads.conversion_goals, ...(v.microsoft_ads?.conversion_goals ?? {}) },
      values: { ...d.microsoft_ads.values, ...(v.microsoft_ads?.values ?? {}) },
    },
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
// Microsoft UET Tag IDs sind reine Zahlen, typischerweise 7–9 Stellen.
// Empty allowed = noch nicht konfiguriert (Bing-Tracking aus).
function isValidUetTag(id: string): boolean {
  return id === "" || /^\d{6,12}$/.test(id.trim());
}

interface LiveStatus {
  gtagLoaded: boolean;
  gtagId: string;
  fbqLoaded: boolean;
  fbqId: string;
  uetLoaded: boolean;
  uetId: string;
  consentMode: boolean;
  configCacheRaw: string | null;
}

function readLiveStatus(): LiveStatus {
  if (typeof window === "undefined") {
    return {
      gtagLoaded: false, gtagId: "",
      fbqLoaded: false, fbqId: "",
      uetLoaded: false, uetId: "",
      consentMode: false, configCacheRaw: null,
    };
  }
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    uetq?: unknown;
    UET?: unknown;
    __TRACKING_BOOT__?: {
      ga4?: string; gads?: string; fb?: string; uet?: string;
      loaded?: { ga4?: string; gads?: string; fb?: string; uet?: string };
    };
    dataLayer?: unknown[];
  };
  const boot = w.__TRACKING_BOOT__;
  // UET ist "geladen", sobald window.UET-Konstruktor existiert ODER uetq
  // eine echte Push-Methode hat (nicht mehr nur eine Queue).
  const uetReady = typeof w.UET !== "undefined" ||
    (typeof w.uetq === "object" && w.uetq !== null && typeof (w.uetq as { push?: unknown }).push === "function" && !Array.isArray(w.uetq));
  return {
    gtagLoaded: typeof w.gtag === "function" && Array.isArray(w.dataLayer) && w.dataLayer.length > 0,
    gtagId: boot?.loaded?.ga4 || boot?.ga4 || "",
    fbqLoaded: typeof w.fbq === "function",
    fbqId: boot?.loaded?.fb || boot?.fb || "",
    uetLoaded: uetReady,
    uetId: boot?.loaded?.uet || boot?.uet || "",
    consentMode: Array.isArray(w.dataLayer) && w.dataLayer.some((x) => Array.isArray(x) && x[0] === "consent"),
    configCacheRaw: (() => { try { return localStorage.getItem("tracking-config-cache"); } catch { return null; } })(),
  };
}

export default function AdminTrackingTab({ value, onChange }: AdminTrackingTabProps) {
  const cfg = ensureConfig(value);
  const [live, setLive] = useState<LiveStatus>(() => readLiveStatus());

  useEffect(() => {
    setLive(readLiveStatus());
    const t = window.setInterval(() => setLive(readLiveStatus()), 2000);
    return () => window.clearInterval(t);
  }, []);

  const update = (patch: Partial<TrackingConfig>) => onChange({ ...cfg, ...patch });
  const updateGa4 = (p: Partial<TrackingConfig["ga4"]>) => update({ ga4: { ...cfg.ga4, ...p } });
  const updateGads = (p: Partial<TrackingConfig["google_ads"]>) =>
    update({ google_ads: { ...cfg.google_ads, ...p } });
  const updateLabel = (key: ConversionLabelKey, label: string) =>
    updateGads({ labels: { ...cfg.google_ads.labels, [key]: label } });
  const updateValue = (key: ConversionLabelKey, value: number) =>
    updateGads({ values: { ...cfg.google_ads.values, [key]: value } });
  const updateGtm = (p: Partial<TrackingConfig["gtm"]>) => update({ gtm: { ...cfg.gtm, ...p } });
  const updatePixel = (p: Partial<TrackingConfig["meta_pixel"]>) =>
    update({ meta_pixel: { ...cfg.meta_pixel, ...p } });

  const ga4Valid = isValidGa4(cfg.ga4.measurement_id);
  const gadsValid = isValidGads(cfg.google_ads.conversion_id);
  const gtmValid = isValidGtm(cfg.gtm.container_id);
  const pixelValid = isValidPixel(cfg.meta_pixel.pixel_id);
  const uetValid = isValidUetTag(cfg.microsoft_ads.uet_tag_id);
  const updateMs = (p: Partial<TrackingConfig["microsoft_ads"]>) =>
    update({ microsoft_ads: { ...cfg.microsoft_ads, ...p } });
  const updateMsGoal = (key: ConversionLabelKey, goal: string) =>
    updateMs({ conversion_goals: { ...cfg.microsoft_ads.conversion_goals, [key]: goal } });
  const updateMsValue = (key: ConversionLabelKey, value: number) =>
    updateMs({ values: { ...cfg.microsoft_ads.values, [key]: value } });

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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
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
              label="Bing UET (uetq)"
              ok={live.uetLoaded}
              detail={live.uetId || "nicht konfiguriert"}
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
            Seitenaufrufe und Anfragen im Browser, nur mit Statistik-Einwilligung.
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
                nur der Teil nach dem Slash. Beispiel: <code>AbC1dEfGhIjKlMnOpQrS</code>
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
                        placeholder="z.B. AbC1dEfGhIjKlMnOpQrS"
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
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {CONVERSION_KEYS.map((key) => {
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
            Optional. Aktuell nutzt KüchenWert direktes gtag.js statt GTM. Ein Container kann zusätzlich
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

      {/* Microsoft Advertising (Bing) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Microsoft Advertising (Bing)
            {!uetValid && (
              <Badge variant="destructive" className="ml-2">Ungültig</Badge>
            )}
            {!cfg.microsoft_ads.enabled && (
              <Badge variant="secondary" className="ml-2">Inaktiv</Badge>
            )}
          </CardTitle>
          <CardDescription>
            UET-Pixel + Custom-Event-Conversions parallel zu Google Ads. Funktioniert
            additiv — wenn deaktiviert oder Tag-ID leer, ändert sich am bisherigen
            Google-Tracking nichts. Der msclkid-Click-ID-Capture läuft unabhängig
            davon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Microsoft Ads aktiviert</Label>
              <p className="text-sm text-muted-foreground">
                Lädt das UET-Pixel und feuert Conversion-Events. Erfordert Marketing-Consent.
              </p>
            </div>
            <Switch
              checked={cfg.microsoft_ads.enabled}
              onCheckedChange={(v) => updateMs({ enabled: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uet-id">UET Tag ID</Label>
            <Input
              id="uet-id"
              value={cfg.microsoft_ads.uet_tag_id}
              onChange={(e) => updateMs({ uet_tag_id: e.target.value })}
              placeholder="z.B. 12345678 (rein numerisch, 7–9 Stellen)"
              className={!uetValid ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Microsoft Advertising → Tools → Conversion Tracking → UET Tags → Tag-ID kopieren.
              Aktuell: <strong>{cfg.microsoft_ads.uet_tag_id || "—"}</strong>
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enhanced Conversions zulassen</Label>
              <p className="text-sm text-muted-foreground">
                Sendet gehashte E-Mail/Telefon mit dem UET-Event. Microsoft empfiehlt das
                stark für Safari/ITP-Attribution.
              </p>
            </div>
            <Switch
              checked={cfg.microsoft_ads.allow_enhanced_conversions}
              onCheckedChange={(v) => updateMs({ allow_enhanced_conversions: v })}
            />
          </div>

          {/* Custom Event Goal Names */}
          <div className="space-y-3 pt-4 border-t">
            <div>
              <h4 className="font-medium">Conversion-Goal-Namen (Custom Events)</h4>
              <p className="text-sm text-muted-foreground">
                In Microsoft Ads anzulegen als <strong>Conversion Goal Type: Custom Event</strong>{" "}
                mit <code>Event Action</code> = exakt dem hier eingetragenen String. Die Defaults
                passen 1:1 zu den Default-Empfehlungen weiter unten in der Anleitung.
              </p>
            </div>
            <div className="space-y-2">
              {CONVERSION_KEYS.map((key) => {
                const meta = CONVERSION_LABELS_DE[key];
                return (
                  <div key={`uet-${key}`} className="grid grid-cols-12 gap-2 items-center rounded-md border p-3">
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
                        value={cfg.microsoft_ads.conversion_goals[key] || ""}
                        onChange={(e) => updateMsGoal(key, e.target.value)}
                        placeholder="z.B. kuechen_lead"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bing Conversion Werte */}
          <div className="space-y-3 pt-4 border-t">
            <div>
              <h4 className="font-medium">Conversion-Werte für Bing-Smart-Bidding (€)</h4>
              <p className="text-sm text-muted-foreground">
                Werden separat von Google Ads gepflegt — Bing-Smart-Bidding kann andere
                Wertgewichtungen brauchen, weil Klicks dort meist günstiger sind.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {CONVERSION_KEYS.map((key) => {
                const meta = CONVERSION_LABELS_DE[key];
                return (
                  <div key={`uetval-${key}`} className="space-y-1">
                    <Label htmlFor={`uetval-${key}`} className="text-xs">{meta.title}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`uetval-${key}`}
                        type="number"
                        step="0.5"
                        min="0"
                        value={cfg.microsoft_ads.values[key] ?? 0}
                        onChange={(e) => updateMsValue(key, parseFloat(e.target.value || "0"))}
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

      <GoogleAdsApiStatusCard
        onApplyTracking={(conversionId, label) =>
          updateGads({
            enabled: true,
            conversion_id: conversionId,
            labels: { ...cfg.google_ads.labels, KUECHEN_LEAD: label },
          })
        }
      />

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
              const w = window as unknown as { gtag?: (...args: unknown[]) => void };
              if (typeof w.gtag === "function") {
                w.gtag("event", "admin_test_event", {
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