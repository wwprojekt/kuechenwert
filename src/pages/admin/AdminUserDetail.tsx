/**
 * Admin User Detail Page
 * Comprehensive view of user profile, roles, activity, and related data
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Shield,
  Ban,
  CheckCircle2,
  Car,
  Gavel,
  Heart,
  MessageSquare,
  Edit,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AdminDetailLayout,
  DetailSection,
  InfoGrid,
  InfoItem,
  StatsCard,
} from "@/components/admin/AdminDetailLayout";
import { UserEditDialog } from "@/components/admin/UserEditDialog";
import { logger } from "@/lib/logger";

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Fetch user with all related data
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["adminUserDetail", id],
    queryFn: async () => {
      // Fetch user profile with roles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles(role)
        `)
        .eq("id", id)
        .single();

      if (profileError) throw profileError;

      // Fetch user's motorhomes
      const { data: motorhomes } = await supabase
        .from("motorhomes")
        .select(`
          id,
          manufacturer,
          model,
          year,
          status,
          sale_channel,
          created_at,
          motorhome_photos(photo_url, display_order)
        `)
        .eq("seller_id", id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch user's bids
      const { data: bids } = await supabase
        .from("bids")
        .select(`
          id,
          amount,
          created_at,
          auction:auctions(
            id,
            status,
            motorhome:motorhomes(manufacturer, model, year)
          )
        `)
        .eq("bidder_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch user's favorites count
      const { count: favoritesCount } = await supabase
        .from("user_favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id);

      // Fetch user's messages count
      const { count: messagesCount } = await supabase
        .from("support_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id);

      // Fetch dealer application if exists
      const { data: dealerApplication } = await supabase
        .from("dealer_applications")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();

      return {
        ...profile,
        roles: profile.user_roles?.map((r: any) => r.role) || [],
        motorhomes: motorhomes || [],
        bids: bids || [],
        favoritesCount: favoritesCount || 0,
        messagesCount: messagesCount || 0,
        dealerApplication,
      };
    },
    enabled: !!id,
  });

  // Suspend/Unsuspend user mutation
  const toggleSuspendMutation = useMutation({
    mutationFn: async (suspend: boolean) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_suspended: suspend,
          suspended_at: suspend ? new Date().toISOString() : null,
          suspended_reason: suspend ? "Administrativ gesperrt" : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, suspend) => {
      toast.success(suspend ? "Benutzer gesperrt" : "Benutzer entsperrt");
      queryClient.invalidateQueries({ queryKey: ["adminUserDetail", id] });
    },
    onError: (error) => {
      logger.error("Toggle suspend error:", error);
      toast.error("Fehler beim Aktualisieren des Benutzerstatus");
    },
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Benutzer nicht gefunden</h2>
          <p className="mt-2 text-muted-foreground">
            Der angeforderte Benutzer existiert nicht oder wurde gelöscht.
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/users")}>
            Zurück zur Übersicht
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy HH:mm", { locale: de });
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      admin: { label: "Admin", variant: "default" },
      dealer: { label: "Händler", variant: "secondary" },
      seller: { label: "Verkäufer", variant: "outline" },
      private: { label: "Privat", variant: "outline" },
    };
    return roleConfig[role] || { label: role, variant: "outline" };
  };

  const displayName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email : "";

  return (
    <AdminDetailLayout
      title={displayName}
      subtitle={user?.email}
      status={
        user?.is_suspended
          ? { label: "Gesperrt", variant: "destructive" }
          : { label: "Aktiv", variant: "default" }
      }
      backUrl="/admin/users"
      backLabel="Alle Benutzer"
      isLoading={isLoading}
      icon={<User className="w-6 h-6" />}
      actions={
        user && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
            {user.is_suspended ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Entsperren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Benutzer entsperren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Der Benutzer kann sich dann wieder anmelden und alle Funktionen nutzen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => toggleSuspendMutation.mutate(false)}>
                      Entsperren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Ban className="w-4 h-4 mr-2" />
                    Sperren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Benutzer sperren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Der Benutzer kann sich nicht mehr anmelden und keine Aktionen mehr durchführen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => toggleSuspendMutation.mutate(true)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Sperren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )
      }
    >
      {user && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label="Inserate"
              value={user.motorhomes?.length || 0}
              icon={<Car className="w-5 h-5" />}
            />
            <StatsCard
              label="Gebote"
              value={user.bids?.length || 0}
              icon={<Gavel className="w-5 h-5" />}
            />
            <StatsCard
              label="Favoriten"
              value={user.favoritesCount}
              icon={<Heart className="w-5 h-5" />}
            />
            <StatsCard
              label="Nachrichten"
              value={user.messagesCount}
              icon={<MessageSquare className="w-5 h-5" />}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Info */}
              <DetailSection title="Profildaten" icon={<User className="w-5 h-5" />}>
                <InfoGrid columns={3}>
                  <InfoItem label="Vorname" value={user.first_name} />
                  <InfoItem label="Nachname" value={user.last_name} />
                  <InfoItem label="E-Mail" value={user.email} icon={<Mail className="w-3 h-3" />} />
                  <InfoItem label="Telefon" value={user.phone} icon={<Phone className="w-3 h-3" />} />
                  <InfoItem label="Firma" value={user.company_name} icon={<Building2 className="w-3 h-3" />} />
                  <InfoItem label="Registriert" value={formatDate(user.created_at)} icon={<Calendar className="w-3 h-3" />} />
                </InfoGrid>

                {/* Roles */}
                <div className="mt-6">
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Rollen
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.length > 0 ? (
                      user.roles.map((role: string) => {
                        const config = getRoleBadge(role);
                        return (
                          <Badge key={role} variant={config.variant}>
                            {config.label}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">Keine Rollen zugewiesen</span>
                    )}
                  </div>
                </div>

                {/* Suspension Info */}
                {user.is_suspended && (
                  <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-2 text-destructive">
                      <Ban className="w-5 h-5" />
                      <span className="font-semibold">Konto gesperrt</span>
                    </div>
                    {user.suspended_at && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Gesperrt am: {formatDate(user.suspended_at)}
                      </p>
                    )}
                    {user.suspended_reason && (
                      <p className="text-sm mt-1">Grund: {user.suspended_reason}</p>
                    )}
                  </div>
                )}
              </DetailSection>

              {/* Tabs for Activity */}
              <Tabs defaultValue="listings" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="listings">Inserate ({user.motorhomes?.length || 0})</TabsTrigger>
                  <TabsTrigger value="bids">Gebote ({user.bids?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="listings">
                  <DetailSection title="Inserate" icon={<Car className="w-5 h-5" />}>
                    {user.motorhomes && user.motorhomes.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fahrzeug</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Verkaufsweg</TableHead>
                            <TableHead>Erstellt</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {user.motorhomes.map((motorhome: any) => {
                            const mainPhoto = motorhome.motorhome_photos?.sort(
                              (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
                            )[0];
                            return (
                              <TableRow key={motorhome.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-9 rounded bg-muted overflow-hidden">
                                      {mainPhoto ? (
                                        <img
                                          src={mainPhoto.photo_url}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Car className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        {motorhome.manufacturer} {motorhome.model}
                                      </p>
                                      <p className="text-xs text-muted-foreground">{motorhome.year}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{motorhome.status}</Badge>
                                </TableCell>
                                <TableCell>{motorhome.sale_channel}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {format(new Date(motorhome.created_at), "dd.MM.yyyy")}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/admin/motorhomes/${motorhome.id}`)}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Keine Inserate vorhanden</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="bids">
                  <DetailSection title="Gebote" icon={<Gavel className="w-5 h-5" />}>
                    {user.bids && user.bids.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Auktion</TableHead>
                            <TableHead>Betrag</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Zeitpunkt</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {user.bids.map((bid: any) => (
                            <TableRow key={bid.id}>
                              <TableCell>
                                <p className="font-medium">
                                  {bid.auction?.motorhome?.manufacturer} {bid.auction?.motorhome?.model}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {bid.auction?.motorhome?.year}
                                </p>
                              </TableCell>
                              <TableCell className="font-semibold">{formatPrice(bid.amount)}</TableCell>
                              <TableCell>
                                <Badge variant={bid.auction?.status === "active" ? "default" : "outline"}>
                                  {bid.auction?.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(bid.created_at)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/admin/auctions/${bid.auction?.id}`)}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Gavel className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Keine Gebote vorhanden</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Schnellaktionen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Profil bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate(`/admin/messages?user=${id}`)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Nachrichten anzeigen
                  </Button>
                  {user.roles.includes("dealer") && user.dealerApplication && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => navigate(`/admin/dealers/${user.dealerApplication.id}`)}
                    >
                      <Building2 className="w-4 h-4 mr-2" />
                      Händlerprofil
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Dealer Application Info */}
              {user.dealerApplication && (
                <DetailSection title="Händlerantrag" icon={<Building2 className="w-5 h-5" />}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge
                        variant={
                          user.dealerApplication.status === "approved"
                            ? "default"
                            : user.dealerApplication.status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {user.dealerApplication.status === "approved"
                          ? "Genehmigt"
                          : user.dealerApplication.status === "pending"
                          ? "Ausstehend"
                          : "Abgelehnt"}
                      </Badge>
                    </div>
                    <InfoItem label="Firma" value={user.dealerApplication.company_name} />
                    <InfoItem label="Stadt" value={user.dealerApplication.city} />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/admin/dealers/${user.dealerApplication.id}`)}
                    >
                      Details anzeigen
                    </Button>
                  </div>
                </DetailSection>
              )}

              {/* Account Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Kontoinformationen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono text-xs">{user.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Registriert</span>
                    <span>{format(new Date(user.created_at), "dd.MM.yyyy")}</span>
                  </div>
                  {user.updated_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aktualisiert</span>
                      <span>{format(new Date(user.updated_at), "dd.MM.yyyy")}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    {user.is_suspended ? (
                      <Badge variant="destructive">Gesperrt</Badge>
                    ) : (
                      <Badge variant="default">Aktiv</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {user && (
        <UserEditDialog
          user={{
            ...user,
            roles: user.roles.map((role: string) => ({ role })),
          }}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}
    </AdminDetailLayout>
  );
}
