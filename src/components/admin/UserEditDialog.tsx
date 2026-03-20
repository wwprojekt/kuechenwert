/**
 * Dialog to edit user profile and manage roles in the admin panel
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Shield, User, Ban } from "lucide-react";
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
  { value: "private", label: "Verkäufer", description: "Kann Wohnmobile einstellen" },
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
  });
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedReason, setSuspendedReason] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
        company_name: user.company_name || "",
      });
      setUserRoles(user.roles?.map((r) => r.role) || []);
      setIsSuspended(user.is_suspended || false);
      setSuspendedReason(user.suspended_reason || "");
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user ID");

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          phone: formData.phone || null,
          company_name: formData.company_name || null,
          is_suspended: isSuspended,
          suspended_at: isSuspended ? new Date().toISOString() : null,
          suspended_reason: isSuspended ? suspendedReason : null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Get current roles
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      toast({
        title: "Gespeichert",
        description: "Benutzer wurde erfolgreich aktualisiert.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error("Update error:", error);
      toast({
        title: "Fehler",
        description: "Benutzer konnte nicht aktualisiert werden.",
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profil</TabsTrigger>
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

              <div className="grid grid-cols-2 gap-4">
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
