import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, Mail, Search, Globe, Loader2, Receipt, Building2, Landmark, FileText, AlertTriangle, Shield, Gavel, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { logger } from "@/lib/logger";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import AdminTrackingTab from "@/components/admin/AdminTrackingTab";
import type { TrackingConfig } from "@/lib/trackingConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';
const SETTINGS_QUERY_KEY = ['admin-site-settings'] as const;
const SESSION_EXPIRED = 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.';

/** Spalten, die diese Seite bearbeitet: Nur sie werden geladen und gespeichert. */
const EDITABLE_FIELDS = [
  'site_name', 'site_tagline', 'site_description', 'contact_email', 'support_phone', 'whatsapp_number',
  'company_address', 'company_city', 'company_postal_code', 'company_country', 'maintenance_mode',
  'managing_director', 'bank_iban', 'bank_bic', 'bank_name', 'ust_id', 'tax_number', 'hrb_number',
  'invoice_payment_terms_days', 'invoice_footer_text',
  'dunning_auto_enabled', 'dunning_level1_days', 'dunning_level1_fee', 'dunning_level2_days',
  'dunning_level2_fee', 'dunning_level3_days', 'dunning_level3_fee', 'dunning_restrict_at_level',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'from_email', 'notify_new_registration',
  'meta_title', 'meta_description', 'meta_keywords', 'sitemap_enabled', 'tracking_config',
] as const;

type SettingsForm = Record<string, unknown>;

async function fetchEditableSettings(): Promise<SettingsForm> {
  if (!(await ensureValidRLSSession())) throw new Error(SESSION_EXPIRED);
  const { data, error } = await supabase
    .from('site_settings')
    .select(EDITABLE_FIELDS.join(', '))
    .eq('id', SETTINGS_ID)
    .single();
  if (error) throw error;
  return data as unknown as SettingsForm;
}

function changedFields(current: SettingsForm, saved: SettingsForm) {
  return EDITABLE_FIELDS.filter((field) => JSON.stringify(current[field] ?? null) !== JSON.stringify(saved[field] ?? null));
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { refreshSettings } = useSettings();
  const { logEvent } = useAuditLog();
  const queryClient = useQueryClient();
  const { data: loaded, error: loadError } = useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: fetchEditableSettings });
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState("general");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  /** Target tab when confirming discard (ref avoids onOpenChange vs. Action click ordering issues). */
  const pendingTabRef = useRef<string | null>(null);

  useEffect(() => {
    if (loaded) {
      setFormData(loaded);
      setSavedSnapshot(JSON.stringify(loaded));
    }
  }, [loaded]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    return JSON.stringify(formData) !== savedSnapshot;
  }, [formData, savedSnapshot]);

  const handleTabChange = (next: string) => {
    if (next === activeTab) return;
    if (isDirty) {
      pendingTabRef.current = next;
      setDiscardDialogOpen(true);
    } else {
      setActiveTab(next);
    }
  };

  const handleConfirmDiscardTab = () => {
    const next = pendingTabRef.current;
    pendingTabRef.current = null;
    if (next != null) {
      try {
        setFormData(JSON.parse(savedSnapshot));
      } catch {
        // ignore corrupt snapshot
      }
      setActiveTab(next);
    }
    setDiscardDialogOpen(false);
  };

  const handleSave = async () => {
    if (!loaded) return;
    const fields = changedFields(formData, loaded);
    if (fields.length === 0) {
      toast({ title: "Keine Änderungen", description: "Es gibt nichts zu speichern." });
      return;
    }
    setIsSaving(true);
    try {
      if (!(await ensureValidRLSSession())) throw new Error(SESSION_EXPIRED);
      const update = Object.fromEntries(fields.map((field) => [field, formData[field]])) as TablesUpdate<'site_settings'>;
      const { error } = await supabase
        .from('site_settings')
        .update(update)
        .eq('id', SETTINGS_ID);

      if (error) throw error;

      await Promise.all([refreshSettings(), queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })]);
      logEvent({ action: "settings_changed", entityType: "settings", details: { fields } });

      toast({
        title: "Einstellungen gespeichert",
        description: "Ihre Änderungen wurden erfolgreich gespeichert.",
      });
    } catch (error) {
      logger.error('Save error:', error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  if (loadError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Einstellungen konnten nicht geladen werden: {loadError.message}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Einstellungen</h1>
          <p className="text-muted-foreground mt-1">
            Verwalten Sie Ihre Plattform-Einstellungen
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Speichert..." : "Änderungen speichern"}
        </Button>
      </div>

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Änderungen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die ungespeicherten Änderungen verwerfen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                pendingTabRef.current = null;
              }}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscardTab}>Verwerfen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="general" className="gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Allgemein</span>
          </TabsTrigger>
          <TabsTrigger value="invoice" className="gap-2">
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Rechnung</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">E-Mail</span>
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-2">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">SEO</span>
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-2">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Tracking</span>
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Allgemeine Einstellungen</CardTitle>
              <CardDescription>
                Grundlegende Informationen über Ihre Plattform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="site-name">Website Name</Label>
                  <Input
                    id="site-name"
                    value={formData.site_name || ''}
                    onChange={(e) => updateField('site_name', e.target.value)}
                    placeholder="Name Ihrer Plattform"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-tagline">Tagline</Label>
                  <Input
                    id="site-tagline"
                    value={formData.site_tagline || ''}
                    onChange={(e) => updateField('site_tagline', e.target.value)}
                    placeholder="Kurze Beschreibung"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-description">Website Beschreibung</Label>
                <Textarea
                  id="site-description"
                  value={formData.site_description || ''}
                  onChange={(e) => updateField('site_description', e.target.value)}
                  placeholder="Detaillierte Beschreibung Ihrer Plattform"
                  rows={4}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Kontakt E-Mail</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={formData.contact_email || ''}
                    onChange={(e) => updateField('contact_email', e.target.value)}
                    placeholder="ihre@email.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-phone">Support Telefon</Label>
                  <Input
                    id="support-phone"
                    type="tel"
                    value={formData.support_phone || ''}
                    onChange={(e) => updateField('support_phone', e.target.value)}
                    placeholder="+49 ..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-number">WhatsApp Nummer</Label>
                <Input
                  id="whatsapp-number"
                  type="tel"
                  value={formData.whatsapp_number || ''}
                  onChange={(e) => updateField('whatsapp_number', e.target.value)}
                  placeholder="+49 170 1234567"
                />
                <p className="text-xs text-muted-foreground">
                  Nummer für den WhatsApp-Support-Button (falls anders als Support-Telefon)
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-address">Firmenadresse (Straße)</Label>
                  <Input
                    id="company-address"
                    value={formData.company_address || ''}
                    onChange={(e) => updateField('company_address', e.target.value)}
                    placeholder="Musterstraße 123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-city">Stadt</Label>
                  <Input
                    id="company-city"
                    value={formData.company_city || ''}
                    onChange={(e) => updateField('company_city', e.target.value)}
                    placeholder="München"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-postal-code">Postleitzahl</Label>
                  <Input
                    id="company-postal-code"
                    value={formData.company_postal_code || ''}
                    onChange={(e) => updateField('company_postal_code', e.target.value)}
                    placeholder="80331"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-country">Land</Label>
                  <Input
                    id="company-country"
                    value={formData.company_country || ''}
                    onChange={(e) => updateField('company_country', e.target.value)}
                    placeholder="Deutschland"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenance-mode">Wartungsmodus</Label>
                  <p className="text-sm text-muted-foreground">
                    Website für Besucher vorübergehend deaktivieren
                  </p>
                </div>
                <Switch 
                  id="maintenance-mode"
                  checked={formData.maintenance_mode || false}
                  onCheckedChange={(checked) => updateField('maintenance_mode', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice / Rechnungseinstellungen */}
        <TabsContent value="invoice" className="space-y-6">
          {/* Firmendaten */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Firmendaten
              </CardTitle>
              <CardDescription>
                Diese Daten erscheinen als Absender auf Ihren Rechnungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-company-name">Firmenname</Label>
                  <Input
                    id="inv-company-name"
                    value={formData.site_name || ''}
                    onChange={(e) => updateField('site_name', e.target.value)}
                    placeholder="KüchenWert GmbH"
                  />
                  <p className="text-xs text-muted-foreground">
                    Wird aus den allgemeinen Einstellungen übernommen
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-managing-director">Geschäftsführer</Label>
                  <Input
                    id="inv-managing-director"
                    value={formData.managing_director || ''}
                    onChange={(e) => updateField('managing_director', e.target.value)}
                    placeholder="Max Mustermann"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-company-address">Straße & Hausnummer</Label>
                  <Input
                    id="inv-company-address"
                    value={formData.company_address || ''}
                    onChange={(e) => updateField('company_address', e.target.value)}
                    placeholder="Musterstraße 123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-company-city">Stadt</Label>
                  <Input
                    id="inv-company-city"
                    value={formData.company_city || ''}
                    onChange={(e) => updateField('company_city', e.target.value)}
                    placeholder="München"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-company-zip">Postleitzahl</Label>
                  <Input
                    id="inv-company-zip"
                    value={formData.company_postal_code || ''}
                    onChange={(e) => updateField('company_postal_code', e.target.value)}
                    placeholder="80331"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-company-country">Land</Label>
                  <Input
                    id="inv-company-country"
                    value={formData.company_country || ''}
                    onChange={(e) => updateField('company_country', e.target.value)}
                    placeholder="Deutschland"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-contact-email">Kontakt E-Mail (Rechnung)</Label>
                  <Input
                    id="inv-contact-email"
                    type="email"
                    value={formData.contact_email || ''}
                    onChange={(e) => updateField('contact_email', e.target.value)}
                    placeholder="info@kuechenwert24.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-support-phone">Telefon (Rechnung)</Label>
                  <Input
                    id="inv-support-phone"
                    type="tel"
                    value={formData.support_phone || ''}
                    onChange={(e) => updateField('support_phone', e.target.value)}
                    placeholder="+49 511 51532476"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bankverbindung */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                Bankverbindung
              </CardTitle>
              <CardDescription>
                Bankdaten für die Zahlungsanweisungen auf Ihren Rechnungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-bank-iban">IBAN</Label>
                  <Input
                    id="inv-bank-iban"
                    value={formData.bank_iban || ''}
                    onChange={(e) => updateField('bank_iban', e.target.value)}
                    placeholder="DE89 3704 0044 0532 0130 00"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-bank-bic">BIC / SWIFT</Label>
                  <Input
                    id="inv-bank-bic"
                    value={formData.bank_bic || ''}
                    onChange={(e) => updateField('bank_bic', e.target.value)}
                    placeholder="COBADEFFXXX"
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-bank-name">Bankname</Label>
                <Input
                  id="inv-bank-name"
                  value={formData.bank_name || ''}
                  onChange={(e) => updateField('bank_name', e.target.value)}
                  placeholder="Commerzbank AG"
                />
              </div>
            </CardContent>
          </Card>

          {/* Steuerliche Angaben */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Steuerliche Angaben
              </CardTitle>
              <CardDescription>
                Pflichtangaben für steuerlich korrekte Rechnungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-ust-id">Umsatzsteuer-ID (USt-IdNr.)</Label>
                  <Input
                    id="inv-ust-id"
                    value={formData.ust_id || ''}
                    onChange={(e) => updateField('ust_id', e.target.value)}
                    placeholder="DE123456789"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pflichtangabe auf jeder Rechnung gemäß §14 UStG
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-tax-number">Steuernummer</Label>
                  <Input
                    id="inv-tax-number"
                    value={formData.tax_number || ''}
                    onChange={(e) => updateField('tax_number', e.target.value)}
                    placeholder="123/456/78901"
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-hrb-number">Handelsregisternummer</Label>
                  <Input
                    id="inv-hrb-number"
                    value={formData.hrb_number || ''}
                    onChange={(e) => updateField('hrb_number', e.target.value)}
                    placeholder="HRB 12345, Amtsgericht München"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-payment-terms">Zahlungsziel (Tage)</Label>
                  <Input
                    id="inv-payment-terms"
                    type="number"
                    value={formData.invoice_payment_terms_days || 14}
                    onChange={(e) => updateField('invoice_payment_terms_days', parseInt(e.target.value))}
                    min="1"
                    max="90"
                  />
                  <p className="text-xs text-muted-foreground">
                    Standard-Zahlungsfrist in Tagen (wird auf neue Rechnungen angewendet)
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-footer-text">Rechnungs-Fußzeile (optional)</Label>
                <Textarea
                  id="inv-footer-text"
                  value={formData.invoice_footer_text || ''}
                  onChange={(e) => updateField('invoice_footer_text', e.target.value)}
                  placeholder="Zusätzlicher Text, der am Ende jeder Rechnung erscheint..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Z.B. AGB-Hinweis, Bankverbindungshinweis oder rechtliche Hinweise
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Mahnwesen-Konfiguration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-orange-600" />
                <CardTitle>Mahnwesen</CardTitle>
              </div>
              <CardDescription>
                Konfigurieren Sie die Mahnstufen, Fristen und Gebühren für das automatische Mahnverfahren
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Automatisches Mahnwesen aktivieren */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Automatisches Mahnwesen</Label>
                  <p className="text-sm text-muted-foreground">
                    Mahnungen werden automatisch per E-Mail versendet, wenn Rechnungen überfällig sind
                  </p>
                </div>
                <Switch
                  checked={formData.dunning_auto_enabled ?? true}
                  onCheckedChange={(checked) => updateField('dunning_auto_enabled', checked)}
                />
              </div>

              {/* Mahnstufe 1 */}
              <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-800">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-400">1. Mahnung – Zahlungserinnerung</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dunning-l1-days">Tage nach Fälligkeit</Label>
                    <Input
                      id="dunning-l1-days"
                      type="number"
                      min={1}
                      max={90}
                      value={formData.dunning_level1_days ?? 14}
                      onChange={(e) => updateField('dunning_level1_days', parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nach wie vielen Tagen nach Fälligkeit die 1. Mahnung versendet wird
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dunning-l1-fee">Mahngebühr (€)</Label>
                    <Input
                      id="dunning-l1-fee"
                      type="number"
                      min={0}
                      step={0.5}
                      value={formData.dunning_level1_fee ?? 5.00}
                      onChange={(e) => updateField('dunning_level1_fee', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Gebühr, die bei der 1. Mahnung erhoben wird
                    </p>
                  </div>
                </div>
              </div>

              {/* Mahnstufe 2 */}
              <div className="p-4 rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <h4 className="font-semibold text-orange-800 dark:text-orange-400">2. Mahnung – Dringende Zahlungsaufforderung</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dunning-l2-days">Tage nach Fälligkeit</Label>
                    <Input
                      id="dunning-l2-days"
                      type="number"
                      min={1}
                      max={120}
                      value={formData.dunning_level2_days ?? 28}
                      onChange={(e) => updateField('dunning_level2_days', parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nach wie vielen Tagen nach Fälligkeit die 2. Mahnung versendet wird
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dunning-l2-fee">Mahngebühr (€)</Label>
                    <Input
                      id="dunning-l2-fee"
                      type="number"
                      min={0}
                      step={0.5}
                      value={formData.dunning_level2_fee ?? 10.00}
                      onChange={(e) => updateField('dunning_level2_fee', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Gebühr, die bei der 2. Mahnung erhoben wird
                    </p>
                  </div>
                </div>
              </div>

              {/* Mahnstufe 3 */}
              <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h4 className="font-semibold text-red-800 dark:text-red-400">3. Mahnung – Letzte Warnung vor rechtlichen Schritten</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dunning-l3-days">Tage nach Fälligkeit</Label>
                    <Input
                      id="dunning-l3-days"
                      type="number"
                      min={1}
                      max={180}
                      value={formData.dunning_level3_days ?? 42}
                      onChange={(e) => updateField('dunning_level3_days', parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nach wie vielen Tagen nach Fälligkeit die 3. Mahnung versendet wird
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dunning-l3-fee">Mahngebühr (€)</Label>
                    <Input
                      id="dunning-l3-fee"
                      type="number"
                      min={0}
                      step={0.5}
                      value={formData.dunning_level3_fee ?? 15.00}
                      onChange={(e) => updateField('dunning_level3_fee', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Gebühr, die bei der 3. Mahnung erhoben wird
                    </p>
                  </div>
                </div>
              </div>

              {/* Einschränkung bei Mahnstufe */}
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold">Kontobeschränkung</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dunning-restrict">Konto sperren ab Mahnstufe</Label>
                    <select
                      id="dunning-restrict"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={formData.dunning_restrict_at_level ?? 2}
                      onChange={(e) => updateField('dunning_restrict_at_level', parseInt(e.target.value))}
                    >
                      <option value={1}>Ab 1. Mahnung</option>
                      <option value={2}>Ab 2. Mahnung</option>
                      <option value={3}>Ab 3. Mahnung</option>
                      <option value={0}>Nie sperren</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Ab welcher Mahnstufe ein Küchenstudio gesperrt wird und keine neuen Projekte mehr erhält
                    </p>
                  </div>
                </div>
              </div>

              {/* Info-Box */}
              <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Receipt className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">So funktioniert das Mahnwesen:</p>
                    <p className="text-blue-700 dark:text-blue-400">
                      Wenn eine Rechnung nicht innerhalb des Zahlungsziels ({formData.invoice_payment_terms_days || 14} Tage) bezahlt wird,
                      startet automatisch das Mahnverfahren. Die Mahnungen werden in den konfigurierten Abständen per E-Mail versendet.
                      Mahngebühren werden dem offenen Betrag hinzugerechnet. Im Mahnprozess-Tab unter Finanzen sehen Sie alle
                      Rechnungen im aktiven Mahnverfahren.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vorschau-Hinweis */}
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Receipt className="w-8 h-8 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Rechnungsvorschau</h4>
                  <p className="text-sm text-muted-foreground">
                    Alle hier eingetragenen Daten werden automatisch auf jede neue Rechnung übernommen.
                    Die Rechnungen werden im KüchenWert-Design erstellt und enthalten Ihre Firmendaten,
                    Bankverbindung und steuerlichen Angaben. Änderungen gelten nur für zukünftige Rechnungen.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Pflichtfelder für gültige Rechnungen:</strong> Firmenname, Adresse, USt-ID oder Steuernummer, Bankverbindung (IBAN)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>E-Mail Einstellungen</CardTitle>
              <CardDescription>
                Konfigurieren Sie E-Mail-Benachrichtigungen und -Vorlagen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    value={formData.smtp_host || ''}
                    onChange={(e) => updateField('smtp_host', e.target.value)}
                    placeholder="smtp.ihrdomain.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={formData.smtp_port || ''}
                    onChange={(e) => updateField('smtp_port', parseInt(e.target.value))}
                    placeholder="587"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">SMTP Benutzername</Label>
                  <Input
                    id="smtp-user"
                    value={formData.smtp_user || ''}
                    onChange={(e) => updateField('smtp_user', e.target.value)}
                    placeholder="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-pass">SMTP Passwort</Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    value={formData.smtp_password || ''}
                    onChange={(e) => updateField('smtp_password', e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-email">Absender E-Mail</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={formData.from_email || ''}
                  onChange={(e) => updateField('from_email', e.target.value)}
                  placeholder="absender@ihredomain.de"
                />
              </div>
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">E-Mail Benachrichtigungen</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Neue Registrierung</Label>
                      <p className="text-sm text-muted-foreground">
                        Benachrichtigung bei neuen Benutzerregistrierungen
                      </p>
                    </div>
                    <Switch 
                      checked={formData.notify_new_registration || false}
                      onCheckedChange={(checked) => updateField('notify_new_registration', checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Settings */}
        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SEO Einstellungen</CardTitle>
              <CardDescription>
                Optimieren Sie Ihre Website für Suchmaschinen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="meta-title">Meta Titel</Label>
                <Input
                  id="meta-title"
                  value={formData.meta_title || ''}
                  onChange={(e) => updateField('meta_title', e.target.value)}
                  placeholder="SEO Titel Ihrer Website"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  Empfohlen: 50-60 Zeichen
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-description">Meta Beschreibung</Label>
                <Textarea
                  id="meta-description"
                  value={formData.meta_description || ''}
                  onChange={(e) => updateField('meta_description', e.target.value)}
                  placeholder="SEO Beschreibung Ihrer Website"
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground">
                  Empfohlen: 150-160 Zeichen
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-keywords">Meta Keywords</Label>
                <Input
                  id="meta-keywords"
                  value={formData.meta_keywords || ''}
                  onChange={(e) => updateField('meta_keywords', e.target.value)}
                  placeholder="Keywords durch Komma getrennt"
                />
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 p-3 text-sm">
                <div className="flex gap-2">
                  <Activity className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-blue-800 dark:text-blue-300">
                    <strong>Google Analytics, Google Ads, Meta Pixel & Conversion-Labels</strong> verwalten Sie
                    jetzt zentral im Tab{" "}
                    <button
                      type="button"
                      onClick={() => handleTabChange('tracking')}
                      className="font-medium underline hover:no-underline"
                    >
                      Tracking
                    </button>
                    . Hier in den SEO-Einstellungen werden nur noch die Meta-Tags verwaltet.
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Sitemap aktivieren</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatische XML Sitemap Generierung
                  </p>
                </div>
                <Switch 
                  checked={formData.sitemap_enabled || false}
                  onCheckedChange={(checked) => updateField('sitemap_enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracking Settings */}
        <TabsContent value="tracking" className="space-y-6">
          <AdminTrackingTab
            value={(formData.tracking_config ?? null) as Partial<TrackingConfig> | null}
            onChange={(next) => updateField('tracking_config', next)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
