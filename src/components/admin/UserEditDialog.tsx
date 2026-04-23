/**
 * Dialog to edit user profile and manage roles in the admin panel.
 *
 * When the admin switches a user's role from "private" (seller) to "dealer",
 * the role is NOT changed directly. Instead a dealer_application with
 * status = "pending" is created so the standard dealer-approval workflow
 * kicks in (banner in dashboard, admin review under "Händler", email
 * notification, etc.).
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { adminSuspendUser } from "@/lib/adminSuspendUser";
import { Loader2, Save, Shield, User, Ban, AlertTriangle, ArrowRightLeft, MapPin } from "lucide-react";
import { logger } from "@/lib/logger";

interface UserRole {
  role: string;
}

interface UserData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  // Privatadresse
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  address_country: string | null;
  // Firmenadresse
  company_street: string | null;
  company_zip: string | null;
  company_city: string | null;
  company_country: string | null;
  //
  is_suspended?: boolean;
  suspended_at?: string | null;
  suspended_reason?: string | null;
  created_at: string;
  roles: UserRole[];
}

interface UserEditDialogProps {
  user: UserData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_ROLES = [
  { value: "admin", label: "Admin", description: "Vollzugriff auf alle Funktionen" },
  { value: "dealer", label: "Händler", description: "Kann auf Auktionen bieten" },
  { value: "seller", label: "Verkäufer", description: "Kann Wohnmobile einstellen" },
];

export function UserEditDialog({
  user,
  open,
  onOpenChange,
}: UserEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    company_name: "",
    // Privatadresse
    address_street: "",
    address_zip: "",
    address_city: "",
    address_country: "",
    // Firmenadresse
    company_street: "",
    company_zip: "",
    company_city: "",
    company_country: "",
  });
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [originalRoles, setOriginalRoles] = useState<string[]>([]);
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedReason, setSuspendedReason] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
        company_name: user.company_name || "",
        // Privatadresse
        address_street: user.address_street || "",
        address_zip: user.address_zip || "",
        address_city: user.address_city || "",
        address_country: user.address_country || "",
        // Firmenadresse
        company_street: user.company_street || "",
        company_zip: user.company_zip || "",
        company_city: user.company_city || "",
        company_country: user.company_country || "",
      });
      const roles = user.roles?.map((r) => r.role) || [];
      setUserRoles(roles);
      setOriginalRoles(roles);
      setIsSuspended(user.is_suspended || false);
      setSuspendedReason(user.suspended_reason || "");
    }
  }, [user]);

  // Detect if this is a seller→dealer upgrade
  const isSellerToDealerUpgrade =
    originalRoles.includes("seller") &&
    !originalRoles.includes("dealer") &&
    userRoles.includes("dealer") &&
    !userRoles.includes("seller");

  // Check if user has dealer role (to show company address section)
  const isDealer = userRoles.includes("dealer");

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user ID");
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      // Update profile including address fields. Suspension status is handled
      // separately below via the atomic admin-suspend-user Edge Function so the
      // affected user receives a notification email when the state actually
      // changes.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          phone: formData.phone || null,
          company_name: formData.company_name || null,
          // Privatadresse (Verkäufer)
          address_street: formData.address_street || null,
          address_zip: formData.address_zip || null,
          address_city: formData.address_city || null,
          address_country: formData.address_country || null,
          // Firmenadresse (Händler/Käufer)
          company_street: formData.company_street || null,
          company_zip: formData.company_zip || null,
          company_city: formData.company_city || null,
          company_country: formData.company_country || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Apply suspend toggle atomically (only if it actually changed) so the
      // user receives the suspend/unsuspend email + audit_log + admin_emails.
      let suspensionResult: { mailSent: boolean; mailError: string | null; changed: boolean } = {
        mailSent: false,
        mailError: null,
        changed: false,
      };
      const previousSuspended = !!user.is_suspended;
      const reasonChanged =
        isSuspended &&
        previousSuspended &&
        (suspendedReason || "") !== (user.suspended_reason || "");
      if (isSuspended !== previousSuspended || reasonChanged) {
        try {
          const r = await adminSuspendUser(user.id, isSuspended, {
            reason: isSuspended ? (suspendedReason || undefined) : undefined,
          });
          suspensionResult = { mailSent: r.mailSent, mailError: r.mailError, changed: true };
        } catch (e) {
          // Surface the error but don't roll back the rest of the profile update.
          logger.error("admin-suspend-user failed:", e);
          suspensionResult = {
            mailSent: false,
            mailError: e instanceof Error ? e.message : String(e),
            changed: true,
          };
        }
      }

      // ── Seller → Dealer upgrade path ──────────────────────────────
      if (isSellerToDealerUpgrade) {
        // 1. Check if there is already a dealer_application for this user
        const { data: existingApp } = await supabase
          .from("dealer_applications")
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingApp && existingApp.status === "pending") {
          throw new Error("Dieser Benutzer hat bereits einen offenen Händlerantrag.");
        }

        // 2. If there is an old rejected/approved application, delete it first
        //    (user_id is UNIQUE, so we need to clear it)
        if (existingApp) {
          const { error: deleteError } = await supabase
            .from("dealer_applications")
            .delete()
            .eq("id", existingApp.id);
          if (deleteError) {
            logger.error("Failed to delete old dealer application:", deleteError);
            throw new Error("Alte Händler-Bewerbung konnte nicht entfernt werden.");
          }
        }

        // 3. Create a new dealer_application with status "pending"
        const contactName = [formData.first_name, formData.last_name]
          .filter(Boolean)
          .join(" ") || user.email;

        const { error: insertError } = await supabase
          .from("dealer_applications")
          .insert({
            user_id: user.id,
            company_name: formData.company_name || `${contactName} (Händler)`,
            company_address: formData.company_street || "Wird vom Händler ergänzt",
            company_postal_code: formData.company_zip || "00000",
            company_city: formData.company_city || "Wird vom Händler ergänzt",
            contact_person_name: contactName,
            phone: formData.phone || "Wird vom Händler ergänzt",
            status: "pending",
          });

        if (insertError) {
          logger.error("Failed to create dealer application:", insertError);
          throw new Error("Händler-Antrag konnte nicht erstellt werden: " + insertError.message);
        }

        // 4. Keep the role as "private" (seller) – do NOT change to dealer yet.
        //    The approve_dealer_application RPC will handle the role change.
        //    But still update other profile fields and non-dealer role changes.

        // 5. Send notification email to the user (fire-and-forget)
        try {
          await invokeWithAuth("send-dealer-notification", {
            body: {
              email: user.email,
              name: contactName,
              type: "role_upgrade",
              companyName: formData.company_name || `${contactName} (Händler)`,
            },
          });
        } catch (emailErr) {
          logger.warn("Failed to send role_upgrade email:", emailErr);
          // Don't fail the whole operation
        }

        return; // Skip normal role update logic
      }

      // ── Standard role update (non seller→dealer) ──────────────────
      const { data: currentRoles, error: getRolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (getRolesError) throw getRolesError;

      const currentRoleNames = currentRoles?.map((r) => r.role) || [];

      // Roles to add
      const rolesToAdd = userRoles.filter((r) => !currentRoleNames.includes(r));
      // Roles to remove
      const rolesToRemove = currentRoleNames.filter((r) => !userRoles.includes(r));

      // Add new roles
      if (rolesToAdd.length > 0) {
        const { error: addError } = await supabase.from("user_roles").insert(
          rolesToAdd.map((role) => ({
            user_id: user.id,
            role,
          }))
        );
        if (addError) throw addError;
      }

      // Remove old roles
      if (rolesToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.id)
          .in("role", rolesToRemove);
        if (removeError) throw removeError;
      }

      return { suspensionResult };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminUserDetail"] });
      queryClient.invalidateQueries({ queryKey: ["dealerApplications"] });

      if (isSellerToDealerUpgrade) {
        toast({
          title: "Händlerantrag erstellt",
          description:
            "Ein Händlerantrag wurde erstellt. Der Benutzer wurde per E-Mail benachrichtigt. Sie finden den Antrag unter Händler → Offene Anträge.",
        });
      } else {
        const susp = result?.suspensionResult;
        let suspNote = "";
        if (susp?.changed) {
          if (susp.mailSent) {
            suspNote = isSuspended
              ? " Sperrung wurde aktiviert und der Benutzer per E-Mail informiert."
              : " Sperrung wurde aufgehoben und der Benutzer per E-Mail informiert.";
          } else if (susp.mailError) {
            suspNote = ` Sperrung aktualisiert, aber E-Mail-Versand fehlgeschlagen: ${susp.mailError}`;
          }
        }
        toast({
          title: "Gespeichert",
          description: `Benutzer wurde erfolgreich aktualisiert.${suspNote}`,
          variant: susp?.changed && susp.mailError ? "destructive" : "default",
        });
      }
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error("Update error:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Benutzer konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const toggleRole = (role: string) => {
    setUserRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = () => {
    updateProfileMutation.mutate();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Benutzer bearbeiten
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profil</TabsTrigger>
              <TabsTrigger value="address">Adresse</TabsTrigger>
              <TabsTrigger value="roles">Rollen</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input value={user.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  E-Mail kann nicht geändert werden
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Vorname</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nachname</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">Firma (optional)</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({ ...formData, company_name: e.target.value })
                  }
                />
              </div>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address" className="space-y-6 mt-4">
              {/* Privatadresse (Verkäufer) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Privatadresse (Verkäufer)</Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Wird im Kaufvertrag als Verkäufer-Anschrift verwendet
                </p>

                <div className="space-y-2">
                  <Label htmlFor="address_street">Straße und Hausnummer</Label>
                  <Input
                    id="address_street"
                    placeholder="z.B. Musterstraße 12"
                    value={formData.address_street}
                    onChange={(e) =>
                      setFormData({ ...formData, address_street: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address_zip">PLZ</Label>
                    <Input
                      id="address_zip"
                      placeholder="30627"
                      value={formData.address_zip}
                      onChange={(e) =>
                        setFormData({ ...formData, address_zip: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="address_city">Stadt</Label>
                    <Input
                      id="address_city"
                      placeholder="Hannover"
                      value={formData.address_city}
                      onChange={(e) =>
                        setFormData({ ...formData, address_city: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_country">Land</Label>
                  <Input
                    id="address_country"
                    placeholder="Deutschland"
                    value={formData.address_country}
                    onChange={(e) =>
                      setFormData({ ...formData, address_country: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Firmenadresse (Händler/Käufer) */}
              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Firmenadresse (Händler/Käufer)</Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Wird im Kaufvertrag als Käufer-Anschrift verwendet
                </p>

                <div className="space-y-2">
                  <Label htmlFor="company_street">Straße und Hausnummer</Label>
                  <Input
                    id="company_street"
                    placeholder="z.B. Gewerbestraße 5"
                    value={formData.company_street}
                    onChange={(e) =>
                      setFormData({ ...formData, company_street: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_zip">PLZ</Label>
                    <Input
                      id="company_zip"
                      placeholder="30627"
                      value={formData.company_zip}
                      onChange={(e) =>
                        setFormData({ ...formData, company_zip: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="company_city">Stadt</Label>
                    <Input
                      id="company_city"
                      placeholder="Hannover"
                      value={formData.company_city}
                      onChange={(e) =>
                        setFormData({ ...formData, company_city: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_country">Land</Label>
                  <Input
                    id="company_country"
                    placeholder="Deutschland"
                    value={formData.company_country}
                    onChange={(e) =>
                      setFormData({ ...formData, company_country: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Hinweis für den Admin */}
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700">
                <MapPin className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                  <strong>Hinweis zur Kaufvertragserstellung:</strong> Die
                  Privatadresse wird als Verkäufer-Anschrift und die Firmenadresse
                  als Käufer-Anschrift im Kaufvertrag verwendet. Bitte stellen Sie
                  sicher, dass die Adressdaten vollständig und korrekt sind, bevor
                  ein Kaufvertrag generiert wird.
                </AlertDescription>
              </Alert>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Benutzerrollen
                </Label>
                <p className="text-sm text-muted-foreground">
                  Wählen Sie die Rollen für diesen Benutzer
                </p>
              </div>

              <div className="space-y-3">
                {AVAILABLE_ROLES.map((role) => (
                  <div
                    key={role.value}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            role.value === "admin"
                              ? "default"
                              : role.value === "dealer"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {role.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {role.description}
                      </p>
                    </div>
                    <Switch
                      checked={userRoles.includes(role.value)}
                      onCheckedChange={() => toggleRole(role.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Info banner when seller→dealer upgrade is detected */}
              {isSellerToDealerUpgrade && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
                  <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>Rollenwechsel: Verkäufer → Händler</strong>
                    <br />
                    <span className="text-sm">
                      Die Rolle wird nicht sofort geändert. Stattdessen wird ein
                      Händlerantrag erstellt, den Sie unter{" "}
                      <strong>Händler → Offene Anträge</strong> genehmigen können.
                      Der Benutzer wird per E-Mail benachrichtigt und sieht im
                      Dashboard einen Hinweis.
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Aktive Rollen:</strong>{" "}
                  {userRoles.length > 0 ? userRoles.join(", ") : "Keine"}
                </p>
              </div>
            </TabsContent>

            {/* Status Tab */}
            <TabsContent value="status" className="space-y-4 mt-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Ban className={`w-5 h-5 ${isSuspended ? "text-destructive" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-medium">Konto sperren</p>
                    <p className="text-sm text-muted-foreground">
                      Gesperrte Benutzer können sich nicht anmelden
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isSuspended}
                  onCheckedChange={setIsSuspended}
                />
              </div>

              {isSuspended && (
                <div className="space-y-2">
                  <Label htmlFor="suspend_reason">Sperrgrund</Label>
                  <Textarea
                    id="suspend_reason"
                    placeholder="Grund für die Sperrung angeben..."
                    value={suspendedReason}
                    onChange={(e) => setSuspendedReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Registriert am:</strong>{" "}
                  {new Date(user.created_at).toLocaleDateString("de-DE")}
                </p>
                {user.suspended_at && (
                  <p className="text-sm text-destructive">
                    <strong>Gesperrt am:</strong>{" "}
                    {new Date(user.suspended_at).toLocaleDateString("de-DE")}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : isSellerToDealerUpgrade ? (
              <ArrowRightLeft className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isSellerToDealerUpgrade ? "Händlerantrag erstellen" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
