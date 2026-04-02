/**
 * Dialog to manually create a new dealer from the admin panel.
 * 
 * Flow:
 * 1. Admin fills in user account data (email, name, phone) + company data
 * 2. Backend: admin-create-user creates auth user + profiles + user_roles(dealer)
 * 3. Backend: INSERT dealer_applications with status='approved'
 * 4. Optional: send-registration-invite sends magic-link email
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  UserPlus,
  Building2,
  User,
  Mail,
  Info,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { EU_COUNTRIES, getLegalFormsByCountry, DEFAULT_COUNTRY } from "@/lib/euCountries";

interface DealerCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialFormData = {
  // User account
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  // Company data
  company_name: "",
  company_address: "",
  company_postal_code: "",
  company_city: "",
  country: DEFAULT_COUNTRY,
  tax_id: "",
  trade_license_number: "",
  contact_person_name: "",
  contact_person_position: "",
  website: "",
  business_description: "",
  legal_form: "",
  founded_year: "" as number | "",
  handelsregister_number: "",
  employee_count: "",
  annual_revenue: "",
  iban: "",
  bic: "",
  // Options
  sendInviteEmail: true,
};

export function DealerCreateDialog({
  open,
  onOpenChange,
}: DealerCreateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("account");

  const resetForm = () => {
    setFormData(initialFormData);
    setActiveTab("account");
  };

  const availableLegalForms = getLegalFormsByCountry(formData.country);

  const handleCountryChange = (countryCode: string) => {
    setFormData({ ...formData, country: countryCode, legal_form: "" });
  };

  const createDealerMutation = useMutation({
    mutationFn: async () => {
      // Validate required fields
      if (!formData.email?.trim()) throw new Error("E-Mail ist erforderlich");
      if (!formData.company_name?.trim()) throw new Error("Firmenname ist erforderlich");
      if (!formData.contact_person_name?.trim()) throw new Error("Ansprechpartner ist erforderlich");

      // Step 1: Create auth user via admin-create-user Edge Function
      const { data: createUserResult, error: createUserError } = await supabase.functions.invoke(
        "admin-create-user",
        {
          body: {
            email: formData.email.trim(),
            firstName: formData.firstName.trim() || undefined,
            lastName: formData.lastName.trim() || undefined,
            phone: formData.phone.trim() || undefined,
            role: "dealer",
          },
        }
      );

      if (createUserError) {
        throw new Error(`Benutzer konnte nicht erstellt werden: ${createUserError.message}`);
      }

      if (!createUserResult?.userId) {
        throw new Error("Benutzer-ID wurde nicht zurückgegeben");
      }

      const userId = createUserResult.userId;
      const isExisting = createUserResult.isExisting;

      // Step 2: Create dealer_applications entry with status='approved'
      const { error: applicationError } = await supabase
        .from("dealer_applications")
        .insert({
          user_id: userId,
          company_name: formData.company_name.trim(),
          company_address: formData.company_address.trim() || "",
          company_postal_code: formData.company_postal_code.trim() || "",
          company_city: formData.company_city.trim() || "",
          country: formData.country,
          tax_id: formData.tax_id.trim() || "",
          trade_license_number: formData.trade_license_number.trim() || "",
          contact_person_name: formData.contact_person_name.trim(),
          contact_person_position: formData.contact_person_position.trim() || null,
          phone: formData.phone.trim() || "",
          website: formData.website.trim() || null,
          business_description: formData.business_description.trim() || null,
          status: "approved",
          submitted_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          legal_form: formData.legal_form || null,
          founded_year: formData.founded_year || null,
          handelsregister_number: formData.handelsregister_number.trim() || null,
          employee_count: formData.employee_count || null,
          annual_revenue: formData.annual_revenue || null,
          iban: formData.iban.trim() || null,
          bic: formData.bic.trim() || null,
        });

      if (applicationError) {
        throw new Error(`Händlerantrag konnte nicht erstellt werden: ${applicationError.message}`);
      }

      // Step 2b: Set profile account_type to 'business' (same as approve_dealer_application)
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ account_type: "business" })
        .eq("id", userId);

      if (profileUpdateError) {
        logger.warn("Profil account_type konnte nicht aktualisiert werden:", profileUpdateError.message);
      }

      // Step 2c: Create dealer_levels entry (Bronze start level)
      const { error: levelError } = await supabase
        .from("dealer_levels")
        .upsert(
          {
            dealer_id: userId,
            level: "bronze",
            total_bids: 0,
            won_auctions: 0,
            total_volume: 0,
            points: 0,
          },
          { onConflict: "dealer_id" }
        );

      if (levelError) {
        logger.warn("Dealer-Level konnte nicht erstellt werden:", levelError.message);
      }

      // Step 3: Optionally send invite email
      if (formData.sendInviteEmail && !isExisting) {
        try {
          await supabase.functions.invoke("send-registration-invite", {
            body: {
              email: formData.email.trim(),
              customerName: formData.contact_person_name.trim() || formData.firstName.trim() || undefined,
              inviteType: "dealer",
              companyName: formData.company_name.trim() || undefined,
            },
          });
        } catch (inviteError) {
          // Don't fail the whole operation if invite fails
          logger.error("Einladungs-E-Mail konnte nicht gesendet werden:", inviteError);
        }
      }

      return { userId, isExisting };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      toast({
        title: "Händler angelegt",
        description: result.isExisting
          ? `Bestehender Benutzer wurde als Händler aktiviert.`
          : `Neuer Händler "${formData.company_name}" wurde erfolgreich angelegt.${formData.sendInviteEmail ? " Eine Einladungs-E-Mail wurde versendet." : ""}`,
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      logger.error("Dealer creation error:", error);
      toast({
        title: "Fehler beim Anlegen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    createDealerMutation.mutate();
  };

  const isValid = formData.email?.trim() && formData.company_name?.trim() && formData.contact_person_name?.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Neuen Händler anlegen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie manuell ein neues Händlerkonto. Der Händler erhält optional eine Einladungs-E-Mail zum Passwort setzen.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[55vh] pr-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account">
                <User className="w-4 h-4 mr-1" />
                Konto
              </TabsTrigger>
              <TabsTrigger value="company">
                <Building2 className="w-4 h-4 mr-1" />
                Firma
              </TabsTrigger>
              <TabsTrigger value="details">
                Details
              </TabsTrigger>
            </TabsList>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-4 mt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Es wird ein neues Benutzerkonto erstellt. Falls bereits ein Konto mit dieser E-Mail existiert, wird der bestehende Benutzer als Händler aktiviert.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_email">
                  E-Mail-Adresse <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create_email"
                  type="email"
                  placeholder="haendler@firma.de"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create_firstName">Vorname</Label>
                  <Input
                    id="create_firstName"
                    placeholder="Max"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create_lastName">Nachname</Label>
                  <Input
                    id="create_lastName"
                    placeholder="Mustermann"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_phone">Telefon</Label>
                <Input
                  id="create_phone"
                  type="tel"
                  placeholder="+49 123 456789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="sendInviteEmail"
                  checked={formData.sendInviteEmail}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, sendInviteEmail: checked === true })
                  }
                />
                <Label htmlFor="sendInviteEmail" className="text-sm font-normal flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  Einladungs-E-Mail mit Passwort-Link senden
                </Label>
              </div>
            </TabsContent>

            {/* Company Tab */}
            <TabsContent value="company" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="create_company_name">
                  Firmenname <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create_company_name"
                  placeholder="Mustermann Wohnmobile GmbH"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_contact_person_name">
                  Ansprechpartner <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create_contact_person_name"
                  placeholder="Max Mustermann"
                  value={formData.contact_person_name}
                  onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_contact_person_position">Position</Label>
                <Input
                  id="create_contact_person_position"
                  placeholder="Geschäftsführer"
                  value={formData.contact_person_position}
                  onChange={(e) => setFormData({ ...formData, contact_person_position: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_country">Land</Label>
                <Select
                  value={formData.country}
                  onValueChange={handleCountryChange}
                >
                  <SelectTrigger id="create_country">
                    <SelectValue placeholder="Land wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {EU_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_company_address">Adresse</Label>
                <Input
                  id="create_company_address"
                  placeholder="Musterstraße 1"
                  value={formData.company_address}
                  onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create_company_postal_code">Postleitzahl</Label>
                  <Input
                    id="create_company_postal_code"
                    placeholder="z.B. 10115"
                    maxLength={10}
                    value={formData.company_postal_code}
                    onChange={(e) => setFormData({ ...formData, company_postal_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create_company_city">Stadt</Label>
                  <Input
                    id="create_company_city"
                    placeholder="Berlin"
                    value={formData.company_city}
                    onChange={(e) => setFormData({ ...formData, company_city: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create_tax_id">Steuernummer / USt-IdNr.</Label>
                  <Input
                    id="create_tax_id"
                    placeholder="z.B. DE123456789"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create_trade_license_number">Gewerbeschein-Nr.</Label>
                  <Input
                    id="create_trade_license_number"
                    value={formData.trade_license_number}
                    onChange={(e) => setFormData({ ...formData, trade_license_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_website">Website</Label>
                <Input
                  id="create_website"
                  type="url"
                  placeholder="https://www.firma.eu"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="create_legal_form">Rechtsform</Label>
                <Select
                  value={formData.legal_form}
                  onValueChange={(value) => setFormData({ ...formData, legal_form: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Rechtsform wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLegalForms.map((lf) => (
                      <SelectItem key={lf.value} value={lf.value}>
                        {lf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.country !== DEFAULT_COUNTRY && (
                  <p className="text-xs text-muted-foreground">
                    Rechtsformen für {EU_COUNTRIES.find(c => c.code === formData.country)?.name || formData.country}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create_founded_year">Gründungsjahr</Label>
                  <Input
                    id="create_founded_year"
                    type="number"
                    placeholder="2020"
                    value={formData.founded_year}
                    onChange={(e) =>
                      setFormData({ ...formData, founded_year: e.target.value ? parseInt(e.target.value) : "" })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create_employee_count">Mitarbeiteranzahl</Label>
                  <Select
                    value={formData.employee_count}
                    onValueChange={(value) => setFormData({ ...formData, employee_count: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-5">1-5 Mitarbeiter</SelectItem>
                      <SelectItem value="6-20">6-20 Mitarbeiter</SelectItem>
                      <SelectItem value="21-50">21-50 Mitarbeiter</SelectItem>
                      <SelectItem value="50+">Mehr als 50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_handelsregister_number">Handelsregisternummer</Label>
                <Input
                  id="create_handelsregister_number"
                  placeholder="HRB 12345"
                  value={formData.handelsregister_number}
                  onChange={(e) => setFormData({ ...formData, handelsregister_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_annual_revenue">Jahresumsatz</Label>
                <Select
                  value={formData.annual_revenue}
                  onValueChange={(value) => setFormData({ ...formData, annual_revenue: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unter_100k">Unter 100.000 €</SelectItem>
                    <SelectItem value="100k_500k">100.000 - 500.000 €</SelectItem>
                    <SelectItem value="500k_1m">500.000 - 1 Mio. €</SelectItem>
                    <SelectItem value="1m_5m">1 - 5 Mio. €</SelectItem>
                    <SelectItem value="ueber_5m">Über 5 Mio. €</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create_iban">IBAN</Label>
                  <Input
                    id="create_iban"
                    placeholder="DE89 3704 0044 0532 0130 00"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create_bic">BIC</Label>
                  <Input
                    id="create_bic"
                    placeholder="COBADEFFXXX"
                    value={formData.bic}
                    onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_business_description">Geschäftsbeschreibung</Label>
                <Textarea
                  id="create_business_description"
                  placeholder="Kurze Beschreibung des Unternehmens..."
                  value={formData.business_description}
                  onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            <span className="text-red-500">*</span> Pflichtfelder
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createDealerMutation.isPending || !isValid}
            >
              {createDealerMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird angelegt...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Händler anlegen
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
