import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Building, Save, MapPin, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

export default function UserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isDealer } = useUserRole();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    company_name: "",
    salutation: "",
    address_street: "",
    address_zip: "",
    address_city: "",
    address_country: "DE",
    account_type: "private",
  });

  // Check email verification status
  useEffect(() => {
    const checkVerification = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setEmailVerified(!!data.user.email_confirmed_at);
      }
    };
    checkVerification();
  }, []);

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        company_name: profile.company_name || "",
        salutation: profile.salutation || "",
        address_street: profile.address_street || "",
        address_zip: profile.address_zip || "",
        address_city: profile.address_city || "",
        address_country: profile.address_country || "DE",
        account_type: profile.account_type || "private",
      });
    }
  }, [profile]);

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw error;
      toast({ title: "Bestätigung gesendet", description: "Bitte prüfen Sie Ihr E-Mail-Postfach" });
    } catch {
      toast({ title: "Fehler", description: "E-Mail konnte nicht gesendet werden", variant: "destructive" });
    } finally {
      setResendingEmail(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error("Not authenticated");

      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      // Convert empty strings to null for fields with CHECK constraints
      const cleanedData = {
        ...data,
        salutation: data.salutation || null,
        account_type: data.account_type || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(cleanedData)
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile", user?.id] });
      toast({
        title: "Profil aktualisiert",
        description: "Ihre Änderungen wurden gespeichert",
      });
    },
    onError: (error: Error) => {
      console.error('Profil-Update Fehler:', error);
      toast({
        title: "Fehler",
        description: `Profil konnte nicht aktualisiert werden: ${error.message || 'Unbekannter Fehler'}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">Lädt...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">Mein Profil</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihre persönlichen Informationen
        </p>
      </div>

      {/* Email & Verification Status */}
      <Card className="p-4 sm:p-6 border-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Mail className="w-4 h-4" />
              E-Mail-Adresse
            </Label>
            <p className="text-sm sm:text-base truncate">{profile?.email || user?.email || ""}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {emailVerified === true ? (
              <Badge className="bg-green-500 text-white flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Bestätigt
              </Badge>
            ) : emailVerified === false ? (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Unbestätigt
                </Badge>
                <Button size="sm" variant="outline" onClick={handleResendVerification} disabled={resendingEmail}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${resendingEmail ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Erneut senden</span>
                  <span className="sm:hidden">Senden</span>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-8 border-2 hover:border-primary/20 transition-smooth hover-lift">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section: Persönliche Daten */}
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <User className="w-5 h-5" />
              Persönliche Daten
            </h2>

            {/* Salutation + Name */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="salutation">Anrede</Label>
                <Select
                  value={formData.salutation}
                  onValueChange={(val) => setFormData({ ...formData, salutation: val })}
                >
                  <SelectTrigger id="salutation">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Herr">Herr</SelectItem>
                    <SelectItem value="Frau">Frau</SelectItem>
                    <SelectItem value="Divers">Divers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">Vorname</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Max"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nachname</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Mustermann"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Telefonnummer
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+49 123 456789"
              />
            </div>
          </div>

          <Separator />

          {/* Section: Adresse */}
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5" />
              Adresse
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address_street">Straße und Hausnummer</Label>
                <Input
                  id="address_street"
                  value={formData.address_street}
                  onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                  placeholder="Musterstraße 123"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address_zip">PLZ</Label>
                <Input
                  id="address_zip"
                  value={formData.address_zip}
                  onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
                  placeholder="80331"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_city">Stadt</Label>
                <Input
                  id="address_city"
                  value={formData.address_city}
                  onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  placeholder="München"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_country">Land</Label>
                <Select
                  value={formData.address_country}
                  onValueChange={(val) => setFormData({ ...formData, address_country: val })}
                >
                  <SelectTrigger id="address_country">
                    <SelectValue placeholder="Land wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DE">Deutschland</SelectItem>
                    <SelectItem value="AT">Österreich</SelectItem>
                    <SelectItem value="CH">Schweiz</SelectItem>
                    <SelectItem value="NL">Niederlande</SelectItem>
                    <SelectItem value="BE">Belgien</SelectItem>
                    <SelectItem value="FR">Frankreich</SelectItem>
                    <SelectItem value="IT">Italien</SelectItem>
                    <SelectItem value="PL">Polen</SelectItem>
                    <SelectItem value="DK">Dänemark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Konto */}
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Building className="w-5 h-5" />
              Kontoinformationen
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account_type">Kontotyp</Label>
                <Select
                  value={isDealer ? "business" : formData.account_type}
                  onValueChange={(val) => setFormData({ ...formData, account_type: val })}
                  disabled={isDealer}
                >
                  <SelectTrigger id="account_type">
                    <SelectValue placeholder="Kontotyp wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {!isDealer && <SelectItem value="private">Privat</SelectItem>}
                    <SelectItem value="business">Gewerblich</SelectItem>
                  </SelectContent>
                </Select>
                {isDealer && (
                  <p className="text-xs text-muted-foreground mt-1">Händlerkonten sind immer gewerblich</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Firmenname {formData.account_type === 'private' ? '(optional)' : ''}</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="z.B. Autohaus Müller GmbH"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="gradient-hero hover:gradient-hero-hover w-full"
            disabled={updateProfileMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {updateProfileMutation.isPending ? "Speichert..." : "Änderungen speichern"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
