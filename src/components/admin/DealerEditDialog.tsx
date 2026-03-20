/**
 * Dialog to edit dealer information in the admin panel
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Save,
  Building2,
  User,
  FileText,
  ExternalLink,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DealerProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface DealerApplication {
  id: string;
  user_id: string;
  company_name: string;
  company_address: string;
  company_postal_code: string;
  company_city: string;
  tax_id: string;
  trade_license_number: string;
  contact_person_name: string;
  contact_person_position: string | null;
  phone: string;
  website: string | null;
  business_description: string | null;
  trade_license_document_url: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  // New fields
  legal_form?: string | null;
  founded_year?: number | null;
  handelsregister_number?: string | null;
  employee_count?: string | null;
  annual_revenue?: string | null;
  iban?: string | null;
  bic?: string | null;
  profiles?: DealerProfile;
}

interface DealerEditDialogProps {
  dealer: DealerApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealerEditDialog({
  dealer,
  open,
  onOpenChange,
}: DealerEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    company_name: "",
    company_address: "",
    company_postal_code: "",
    company_city: "",
    tax_id: "",
    trade_license_number: "",
    contact_person_name: "",
    contact_person_position: "",
    phone: "",
    website: "",
    business_description: "",
    legal_form: "",
    founded_year: "" as number | "",
    handelsregister_number: "",
    employee_count: "",
    annual_revenue: "",
    iban: "",
    bic: "",
  });

  useEffect(() => {
    if (dealer) {
      setFormData({
        company_name: dealer.company_name || "",
        company_address: dealer.company_address || "",
        company_postal_code: dealer.company_postal_code || "",
        company_city: dealer.company_city || "",
        tax_id: dealer.tax_id || "",
        trade_license_number: dealer.trade_license_number || "",
        contact_person_name: dealer.contact_person_name || "",
        contact_person_position: dealer.contact_person_position || "",
        phone: dealer.phone || "",
        website: dealer.website || "",
        business_description: dealer.business_description || "",
        legal_form: dealer.legal_form || "",
        founded_year: dealer.founded_year || "",
        handelsregister_number: dealer.handelsregister_number || "",
        employee_count: dealer.employee_count || "",
        annual_revenue: dealer.annual_revenue || "",
        iban: dealer.iban || "",
        bic: dealer.bic || "",
      });
    }
  }, [dealer]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!dealer?.id) throw new Error("No dealer ID");

      const { error } = await supabase
        .from("dealer_applications")
        .update({
          company_name: formData.company_name,
          company_address: formData.company_address,
          company_postal_code: formData.company_postal_code,
          company_city: formData.company_city,
          tax_id: formData.tax_id,
          trade_license_number: formData.trade_license_number,
          contact_person_name: formData.contact_person_name,
          contact_person_position: formData.contact_person_position || null,
          phone: formData.phone,
          website: formData.website || null,
          business_description: formData.business_description || null,
          legal_form: formData.legal_form || null,
          founded_year: formData.founded_year || null,
          handelsregister_number: formData.handelsregister_number || null,
          employee_count: formData.employee_count || null,
          annual_revenue: formData.annual_revenue || null,
          iban: formData.iban || null,
          bic: formData.bic || null,
        })
        .eq("id", dealer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });
      toast({
        title: "Gespeichert",
        description: "Händler wurde erfolgreich aktualisiert.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error("Update error:", error);
      toast({
        title: "Fehler",
        description: "Händler konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  const getLegalFormLabel = (value: string) => {
    const labels: Record<string, string> = {
      einzelunternehmen: "Einzelunternehmen",
      gbr: "GbR",
      ug: "UG (haftungsbeschränkt)",
      gmbh: "GmbH",
      ag: "AG",
    };
    return labels[value] || value;
  };

  const getEmployeeCountLabel = (value: string) => {
    const labels: Record<string, string> = {
      "1-5": "1-5 Mitarbeiter",
      "6-20": "6-20 Mitarbeiter",
      "21-50": "21-50 Mitarbeiter",
      "50+": "Mehr als 50",
    };
    return labels[value] || value;
  };

  if (!dealer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Händler bearbeiten
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <Tabs defaultValue="company" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="company">Firma</TabsTrigger>
              <TabsTrigger value="contact">Kontakt</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>

            {/* Company Tab */}
            <TabsContent value="company" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Firmenname</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({ ...formData, company_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_address">Adresse</Label>
                <Input
                  id="company_address"
                  value={formData.company_address}
                  onChange={(e) =>
                    setFormData({ ...formData, company_address: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_postal_code">PLZ</Label>
                  <Input
                    id="company_postal_code"
                    value={formData.company_postal_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        company_postal_code: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_city">Stadt</Label>
                  <Input
                    id="company_city"
                    value={formData.company_city}
                    onChange={(e) =>
                      setFormData({ ...formData, company_city: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax_id">Steuernummer</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_id: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trade_license_number">Gewerbeschein-Nr.</Label>
                  <Input
                    id="trade_license_number"
                    value={formData.trade_license_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        trade_license_number: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_person_name">Ansprechpartner</Label>
                  <Input
                    id="contact_person_name"
                    value={formData.contact_person_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact_person_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person_position">Position</Label>
                  <Input
                    id="contact_person_position"
                    value={formData.contact_person_position}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact_person_position: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_description">
                  Geschäftsbeschreibung
                </Label>
                <Textarea
                  id="business_description"
                  rows={4}
                  value={formData.business_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      business_description: e.target.value,
                    })
                  }
                />
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legal_form">Rechtsform</Label>
                  <Input
                    id="legal_form"
                    value={formData.legal_form}
                    onChange={(e) =>
                      setFormData({ ...formData, legal_form: e.target.value })
                    }
                    placeholder="z.B. gmbh, ug, einzelunternehmen"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="founded_year">Gründungsjahr</Label>
                  <Input
                    id="founded_year"
                    type="number"
                    value={formData.founded_year}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        founded_year: e.target.value
                          ? parseInt(e.target.value, 10)
                          : "",
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="handelsregister_number">
                    Handelsregisternummer
                  </Label>
                  <Input
                    id="handelsregister_number"
                    value={formData.handelsregister_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        handelsregister_number: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_count">Mitarbeiter</Label>
                  <Input
                    id="employee_count"
                    value={formData.employee_count}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employee_count: e.target.value,
                      })
                    }
                    placeholder="z.B. 1-5, 6-20, 21-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={formData.iban}
                    onChange={(e) =>
                      setFormData({ ...formData, iban: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bic">BIC</Label>
                  <Input
                    id="bic"
                    value={formData.bic}
                    onChange={(e) =>
                      setFormData({ ...formData, bic: e.target.value })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      dealer.status === "approved" ? "default" : "secondary"
                    }
                  >
                    {dealer.status === "approved"
                      ? "Genehmigt"
                      : dealer.status === "pending"
                      ? "Ausstehend"
                      : "Abgelehnt"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Eingereicht am
                  </span>
                  <span className="text-sm">
                    {format(new Date(dealer.submitted_at), "dd.MM.yyyy HH:mm", {
                      locale: de,
                    })}
                  </span>
                </div>

                {dealer.reviewed_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Genehmigt am
                    </span>
                    <span className="text-sm">
                      {format(
                        new Date(dealer.reviewed_at),
                        "dd.MM.yyyy HH:mm",
                        { locale: de }
                      )}
                    </span>
                  </div>
                )}

                {dealer.legal_form && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Rechtsform
                    </span>
                    <span className="text-sm">
                      {getLegalFormLabel(dealer.legal_form)}
                    </span>
                  </div>
                )}

                {dealer.employee_count && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Mitarbeiter
                    </span>
                    <span className="text-sm">
                      {getEmployeeCountLabel(dealer.employee_count)}
                    </span>
                  </div>
                )}
              </div>

              {dealer.profiles && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Verknüpfter Benutzer
                  </Label>
                  <div className="p-3 border rounded-lg space-y-1">
                    <p className="font-medium">
                      {dealer.profiles.first_name} {dealer.profiles.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dealer.profiles.email}
                    </p>
                    {dealer.profiles.phone && (
                      <p className="text-sm text-muted-foreground">
                        {dealer.profiles.phone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {dealer.trade_license_document_url && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Gewerbeschein
                  </Label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      window.open(dealer.trade_license_document_url!, "_blank")
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Dokument öffnen
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
