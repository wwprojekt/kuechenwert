import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, Palette, Mail, Search, Globe, Loader2, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import { logger } from "@/lib/logger";

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

export default function AdminSettings() {
  const { toast } = useToast();
  const { settings, refreshSettings } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const tuvBadgeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleFileUpload = async (file: File, type: 'logo' | 'favicon' | 'tuv_badge') => {
    try {
      setIsUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file, { upsert: true });

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
      const { error } = await supabase
        .from('site_settings')
        .update(formData)
        .eq('id', SETTINGS_ID);

      if (error) throw error;

      await refreshSettings();
      
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
          <h1 className="text-3xl font-bold text-foreground">Einstellungen</h1>
          <p className="text-muted-foreground mt-1">
            Verwalten Sie Ihre Plattform-Einstellungen und Branding
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Speichert..." : "Änderungen speichern"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="general" className="gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Allgemein</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Branding</span>
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
                <div className="space-y-2">
                  <Label htmlFor="commission-rate">Provisionsrate (%)</Label>
                  <Input
                    id="commission-rate"
                    type="number"
                    value={formData.commission_rate_percent || ''}
                    onChange={(e) => updateField('commission_rate_percent', parseFloat(e.target.value))}
                    min="0"
                    max="20"
                    step="0.5"
                  />
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
      </Tabs>
    </div>
  );
}
