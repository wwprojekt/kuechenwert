import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, Palette, Mail, Search, Globe, Loader2, Award, Receipt, Building2, Landmark, FileText, AlertTriangle, Shield, Gavel, Brain, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { logger } from "@/lib/logger";
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

/** Snapshot for dirty check (UI-only fields excluded). */
function settingsFormSnapshot(data: Record<string, unknown>): string {
  const { _showApiKey: _ui, ...rest } = data;
  return JSON.stringify(rest);
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { settings, refreshSettings } = useSettings();
  const { logEvent } = useAuditLog();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const tuvBadgeInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  /** Target tab when confirming discard (ref avoids onOpenChange vs. Action click ordering issues). */
  const pendingTabRef = useRef<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setSavedSnapshot(settingsFormSnapshot(settings as Record<string, unknown>));
    }
  }, [settings]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    return settingsFormSnapshot(formData as Record<string, unknown>) !== savedSnapshot;
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

  const handleFileUpload = async (file: File, type: 'logo' | 'favicon' | 'tuv_badge') => {
    try {
      setIsUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || `image/${fileExt}`,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('branding')
        .getPublicUrl(filePath);

      setFormData({ ...formData, [`${type}_url`]: publicUrl });
      
      const typeLabels: Record<string, string> = {
        logo: 'Logo',
        favicon: 'Favicon',
        tuv_badge: 'TÜV Badge'
      };
      
      toast({
        title: "Datei hochgeladen",
        description: `${typeLabels[type]} erfolgreich hochgeladen.`,
      });
    } catch (error) {
      logger.error('Upload error:', error);
      toast({
        title: "Fehler",
        description: "Datei konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // UI-interne Felder rausfiltern vor dem Speichern
      const { _showApiKey, ...saveData } = formData;
      const { error } = await supabase
        .from('site_settings')
        .update(saveData)
        .eq('id', SETTINGS_ID);

      if (error) throw error;

      await refreshSettings();
      logEvent({ action: "settings_changed", entityType: "settings", details: { fields: Object.keys(saveData) } });

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

  // Helper function to convert HSL to Hex for color picker
  const hslToHex = (hsl: string): string => {
    const [h, s, l] = hsl.split(' ').map(Number);
    const hDecimal = l / 100;
    const a = (s * Math.min(hDecimal, 1 - hDecimal)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = hDecimal - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Helper function to convert Hex to HSL
  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)} ${Math.round(l * 100)}`;
  };

  if (!settings) {
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
            Verwalten Sie Ihre Plattform-Einstellungen und Branding
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
        <TabsList className="grid w-full grid-cols-7 lg:w-auto">
          <TabsTrigger value="general" className="gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Allgemein</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Branding</span>
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
          <TabsTrigger value="auction" className="gap-2">
            <span className="hidden sm:inline">Auktionen</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">KI / API</span>
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

        {/* Branding Settings */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding & Design</CardTitle>
              <CardDescription>
                Passen Sie das Erscheinungsbild Ihrer Plattform an
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden">
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'logo');
                        }}
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Logo hochladen
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        PNG oder SVG, max. 2MB, empfohlen 512x512px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden">
                      {formData.favicon_url ? (
                        <img src={formData.favicon_url} alt="Favicon" className="w-full h-full object-contain" />
                      ) : (
                        <Upload className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={faviconInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'favicon');
                        }}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => faviconInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Favicon hochladen
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        ICO oder PNG, 32x32px oder 64x64px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>TÜV-Zertifikat Badge</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden">
                      {formData.tuv_badge_url ? (
                        <img src={formData.tuv_badge_url} alt="TÜV Badge" className="w-full h-full object-contain" />
                      ) : (
                        <Award className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={tuvBadgeInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'tuv_badge');
                        }}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => tuvBadgeInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        TÜV Badge hochladen
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        PNG oder SVG, wird im Footer angezeigt
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Farbschema</h4>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primary-color">Primärfarbe</Label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        value={formData.primary_color ? hslToHex(formData.primary_color) : '#FF6B35'}
                        onChange={(e) => updateField('primary_color', hexToHsl(e.target.value))}
                        className="w-20 h-12 rounded-lg border-2 border-border cursor-pointer hover:border-primary transition-colors"
                      />
                      <div className="flex-1 space-y-1">
                        <Input
                          id="primary-color"
                          value={formData.primary_color || ''}
                          onChange={(e) => updateField('primary_color', e.target.value)}
                          placeholder="16 100 60"
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">HSL: {formData.primary_color || '16 100 60'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondary-color">Sekundärfarbe</Label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="color"
                        value={formData.secondary_color ? hslToHex(formData.secondary_color) : '#1A3A52'}
                        onChange={(e) => updateField('secondary_color', hexToHsl(e.target.value))}
                        className="w-20 h-12 rounded-lg border-2 border-border cursor-pointer hover:border-primary transition-colors"
                      />
                      <div className="flex-1 space-y-1">
                        <Input
                          id="secondary-color"
                          value={formData.secondary_color || ''}
                          onChange={(e) => updateField('secondary_color', e.target.value)}
                          placeholder="210 40 28"
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">HSL: {formData.secondary_color || '210 40 28'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">
                    <strong>Tipp:</strong> Verwenden Sie die Farbwähler für eine visuelle Auswahl oder geben Sie HSL-Werte manuell ein (Format: H S L, z.B. "16 100 60").
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode">Dark Mode aktivieren</Label>
                  <p className="text-sm text-muted-foreground">
                    Dunkles Theme für die Website
                  </p>
                </div>
                <Switch 
                  id="dark-mode"
                  checked={formData.dark_mode_enabled || false}
                  onCheckedChange={(checked) => updateField('dark_mode_enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
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
                    placeholder="CaravanWert GmbH"
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
                    placeholder="info@caravanwert.de"
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
                      Ab welcher Mahnstufe der Händler keine neuen Auktionen mehr erstellen kann
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
                    Die Rechnungen werden im CaravanWert-Design erstellt und enthalten Ihre Firmendaten,
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
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Neue Auktion</Label>
                      <p className="text-sm text-muted-foreground">
                        Benachrichtigung bei neu erstellten Auktionen
                      </p>
                    </div>
                    <Switch 
                      checked={formData.notify_new_auction || false}
                      onCheckedChange={(checked) => updateField('notify_new_auction', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Gebote</Label>
                      <p className="text-sm text-muted-foreground">
                        Benachrichtigung bei neuen Geboten
                      </p>
                    </div>
                    <Switch 
                      checked={formData.notify_new_bid || false}
                      onCheckedChange={(checked) => updateField('notify_new_bid', checked)}
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
              <div className="space-y-2">
                <Label htmlFor="google-analytics">Google Analytics ID</Label>
                <Input
                  id="google-analytics"
                  value={formData.google_analytics_id || ''}
                  onChange={(e) => updateField('google_analytics_id', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google-tag-manager">Google Tag Manager ID</Label>
                <Input
                  id="google-tag-manager"
                  value={formData.google_tag_manager_id || ''}
                  onChange={(e) => updateField('google_tag_manager_id', e.target.value)}
                  placeholder="GTM-XXXXXXX"
                />
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

        {/* Auction Settings */}
        <TabsContent value="auction" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auktionseinstellungen</CardTitle>
              <CardDescription>
                Konfigurieren Sie Standard-Auktionsparameter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default-duration">Standard Auktionsdauer (Tage)</Label>
                  <Input
                    id="default-duration"
                    type="number"
                    value={formData.default_auction_duration_days || ''}
                    onChange={(e) => updateField('default_auction_duration_days', parseInt(e.target.value))}
                    min="1"
                    max="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soft-close-minutes">Soft-Close Verlängerung (Minuten)</Label>
                  <Input
                    id="soft-close-minutes"
                    type="number"
                    value={formData.soft_close_extension_minutes || ''}
                    onChange={(e) => updateField('soft_close_extension_minutes', parseInt(e.target.value))}
                    min="1"
                    max="60"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min-bid-increment">Min. Geboterhöhung (%)</Label>
                  <Input
                    id="min-bid-increment"
                    type="number"
                    value={formData.min_bid_increment_percent || ''}
                    onChange={(e) => updateField('min_bid_increment_percent', parseFloat(e.target.value))}
                    min="1"
                    max="10"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800 p-4">
                <div className="flex items-start gap-3">
                  <Receipt className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Provisionen verwalten</p>
                    <p className="text-blue-700 dark:text-blue-400">
                      Die Provisionsstaffeln und Volumen-Rabatte werden unter{" "}
                      <a href="/admin/commissions" className="font-medium underline hover:no-underline">
                        Admin → Provisionen
                      </a>{" "}
                      verwaltet. Dort können Sie Staffeln (min./max. Verkaufssumme, Prozent- oder Fixbetrag)
                      und Volumen-Rabatte pro Händler konfigurieren. Die dort gesetzten Werte werden automatisch
                      sowohl bei Auktions-Zuschlägen als auch bei Sofortkäufen verwendet.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Auktionsregeln</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Reservepreis erforderlich</Label>
                      <p className="text-sm text-muted-foreground">
                        Verkäufer müssen einen Mindestpreis festlegen
                      </p>
                    </div>
                    <Switch 
                      checked={formData.reserve_price_required || false}
                      onCheckedChange={(checked) => updateField('reserve_price_required', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Automatische Gebote erlauben</Label>
                      <p className="text-sm text-muted-foreground">
                        Bieter können Maximalgebote setzen
                      </p>
                    </div>
                    <Switch 
                      checked={formData.autobid_enabled || false}
                      onCheckedChange={(checked) => updateField('autobid_enabled', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Sofort-Kaufen Option</Label>
                      <p className="text-sm text-muted-foreground">
                        Verkäufer können Sofortkaufpreis anbieten
                      </p>
                    </div>
                    <Switch 
                      checked={formData.buy_now_enabled || false}
                      onCheckedChange={(checked) => updateField('buy_now_enabled', checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KI / API Settings */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                KI-Bewertungssystem
              </CardTitle>
              <CardDescription>
                Konfigurieren Sie die KI-gestützte Wohnmobil-Bewertung. Die KI lernt aus Ihren Expertenbewertungen und wird mit der Zeit immer genauer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="openai-api-key" className="flex items-center gap-2">
                  OpenAI API-Key
                  {formData.openai_api_key ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-normal">
                      <CheckCircle2 className="w-3 h-3" /> Konfiguriert
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-orange-500 font-normal">
                      <XCircle className="w-3 h-3" /> Nicht konfiguriert
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="openai-api-key"
                    type={formData._showApiKey ? "text" : "password"}
                    value={formData.openai_api_key || ''}
                    onChange={(e) => updateField('openai_api_key', e.target.value)}
                    placeholder="sk-..."
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, _showApiKey: !formData._showApiKey })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground active:text-foreground"
                  >
                    {formData._showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Benötigt für die KI-Bewertung im Wertrechner. Erhalten Sie einen Key unter{" "}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    platform.openai.com/api-keys
                  </a>
                  . Kosten: ca. 0,001€ pro Bewertung.
                </p>
              </div>

              <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                <h4 className="font-medium text-sm">So funktioniert das KI-System:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Ein Nutzer bewertet sein Wohnmobil im <strong>Wertrechner</strong></li>
                  <li>Der <strong>Algorithmus</strong> berechnet einen Schätzwert basierend auf Marke, Typ, Alter und Zustand</li>
                  <li>Die <strong>KI</strong> wird im Hintergrund abgefragt und liefert eine zusätzliche Schätzung</li>
                  <li>Sie tragen im Admin-Bereich unter <strong>Leads → Wertrechner</strong> Ihren fundierten Expertenwert ein</li>
                  <li>Die KI <strong>lernt</strong> aus Ihren Expertenwerten und wird mit jeder Bewertung genauer</li>
                </ol>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Hinweis zur Sicherheit</p>
                    <p className="text-amber-700 mt-1">
                      Der API-Key wird verschlüsselt in der Datenbank gespeichert und nur serverseitig in Edge Functions verwendet.
                      Er ist niemals im Frontend sichtbar.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
