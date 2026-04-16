/**
 * Admin Auction Detail Page
 * Comprehensive view of auction with bids, motorhome info, and actions
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditLog } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Gavel,
  Car,
  User,
  TrendingUp,
  Euro,
  Calendar,
  Play,
  Ban,
  Edit,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Users,
  Image as ImageIcon,
  Mail,
  Phone,
  Trash2,
  Scale,
  Receipt,
  Clock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { AuctionEditDialog } from "@/components/admin/AuctionEditDialog";
import { CreateSellerPenaltyDialog } from "@/components/admin/CreateSellerPenaltyDialog";
import { logger } from "@/lib/logger";

export default function AdminAuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logEvent } = useAuditLog();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPenaltyDialog, setShowPenaltyDialog] = useState(false);

  // Fetch auction with all related data
  const { data: auction, isLoading, error } = useQuery({
    queryKey: ["adminAuctionDetail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          motorhome:motorhomes (
            *,
            motorhome_photos(id, url, display_order),
            seller:profiles!left (
              id,
              first_name,
              last_name,
              email,
              phone,
              company_name
            )
          ),
          auction_addenda(id, content, created_at),
          bids (
            id,
            amount,
            created_at,
            is_autobid,
            bidder:profiles!bids_bidder_id_fkey (
              id,
              first_name,
              last_name,
              email,
              company_name
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Activate auction mutation
  const activateAuctionMutation = useMutation({
    mutationFn: async () => {
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 7);

      const { error } = await supabase
        .from("auctions")
        .update({
          status: "active",
          start_time: new Date().toISOString(),
          end_time: endTime.toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich aktiviert");
      logEvent({ action: "auction_activated", entityType: "auction", entityId: id });
      queryClient.invalidateQueries({ queryKey: ["adminAuctionDetail", id] });
    },
    onError: (error) => {
      logger.error("Activate auction error:", error);
      toast.error("Fehler beim Aktivieren der Auktion");
    },
  });

  // Cancel auction mutation
  const cancelAuctionMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("auctions")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich abgebrochen");
      logEvent({ action: "auction_cancelled", entityType: "auction", entityId: id });
      queryClient.invalidateQueries({ queryKey: ["adminAuctionDetail", id] });
    },
    onError: (error) => {
      logger.error("Cancel auction error:", error);
      toast.error("Fehler beim Abbrechen der Auktion");
    },
  });

  const deleteBidMutation = useMutation({
    mutationFn: async (bidId: string) => {
      const { data, error } = await supabase.rpc("admin_delete_bid", { p_bid_id: bidId });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Gebot über ${formatPrice(data.deleted_amount)} gelöscht`);
      queryClient.invalidateQueries({ queryKey: ["adminAuctionDetail", id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Löschen des Gebots");
    },
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Auktion nicht gefunden</h2>
          <p className="mt-2 text-muted-foreground">
            Die angeforderte Auktion existiert nicht oder wurde gelöscht.
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/auctions")}>
            Zurück zur Übersicht
          </Button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number | null) => {
    if (!price) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy HH:mm", { locale: de });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Entwurf", variant: "outline" },
      active: { label: "Aktiv", variant: "default" },
      ended: { label: "Beendet", variant: "secondary" },
      sold: { label: "Verkauft", variant: "default" },
      cancelled: { label: "Abgebrochen", variant: "destructive" },
      kaufchance: { label: "Kaufchance", variant: "secondary" },
    };
    return statusConfig[status] || { label: status, variant: "outline" };
  };

  // Ensure bids is always an array (Supabase may return a single object for 1:N relations)
  const rawBids = auction?.bids;
  const bidsArray = Array.isArray(rawBids) ? rawBids : rawBids ? [rawBids] : [];
  const sortedBids = [...bidsArray].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const highestBid = sortedBids[0];
  const bidCount = sortedBids.length;
  const uniqueBidders = new Set(sortedBids.map((b: any) => b.bidder?.id)).size;

  // Get main photo – ensure motorhome_photos is always an array
  const rawPhotos = auction?.motorhome?.motorhome_photos;
  const photosArray = Array.isArray(rawPhotos) ? rawPhotos : rawPhotos ? [rawPhotos] : [];
  const mainPhoto = [...photosArray].sort(
    (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
  )[0];

  return (
    <AdminDetailLayout
      title={auction ? `${auction.motorhome?.manufacturer} ${auction.motorhome?.model}` : "Auktion"}
      subtitle={auction?.motorhome ? `${auction.motorhome.year} • ${auction.motorhome.body_type}` : undefined}
      status={auction ? getStatusBadge(auction.status) : undefined}
      backUrl="/admin/auctions"
      backLabel="Alle Auktionen"
      isLoading={isLoading}
      icon={<Gavel className="w-6 h-6" />}
      actions={
        auction && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/financials")}
            >
              <Receipt className="w-4 h-4 mr-2" />
              Finanzen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/auktion/${id}`, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Öffentliche Ansicht
            </Button>
            {auction.status === "draft" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <Play className="w-4 h-4 mr-2" />
                    Aktivieren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auktion aktivieren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Die Auktion wird für 7 Tage aktiviert und ist dann öffentlich sichtbar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => activateAuctionMutation.mutate()}>
                      Aktivieren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {(auction.status === "active" || auction.status === "draft" || auction.status === "kaufchance") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Ban className="w-4 h-4 mr-2" />
                    Auktion abbrechen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auktion abbrechen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Die Auktion wird abgebrochen. Es werden keine Benachrichtigungen an Bieter oder Verkäufer versendet.
                      Der Verkäufer kann sein Inserat danach wieder bearbeiten und Fotos hochladen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Zurück</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelAuctionMutation.mutate()}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Abbrechen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )
      }
    >
      {auction && (
        <div className="space-y-6">
          {/* Instant-price-only notice */}
          {auction.motorhome?.sale_channel === 'instant_price' && (
            <div className="p-3 rounded-lg border-2 border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/20 flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">Nur Festpreis – kein Bieterverfahren</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Der Verkäufer möchte nur per Sofortkauf verkaufen.
                  {auction.motorhome?.instant_price ? ` Festpreis: ${formatPrice(auction.motorhome.instant_price)}` : ' Kein Preis hinterlegt!'}
                </p>
              </div>
            </div>
          )}

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label={auction.motorhome?.sale_channel === 'instant_price' ? 'Festpreis' : 'Aktuelles Gebot'}
              value={auction.motorhome?.sale_channel === 'instant_price' ? formatPrice(auction.motorhome?.instant_price) : formatPrice(auction.current_bid || auction.starting_bid)}
              icon={<Euro className="w-5 h-5" />}
            />
            <StatsCard
              label="Anzahl Gebote"
              value={bidCount}
              icon={<Gavel className="w-5 h-5" />}
            />
            <StatsCard
              label="Bieter"
              value={uniqueBidders}
              icon={<Users className="w-5 h-5" />}
            />
            <StatsCard
              label={auction.status === "active" ? "Endet in" : "Status"}
              value={
                auction.status === "active" && auction.end_time
                  ? format(new Date(auction.end_time), "dd.MM. HH:mm")
                  : getStatusBadge(auction.status).label
              }
              icon={<Timer className="w-5 h-5" />}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Auction Details */}
              <DetailSection title="Auktionsdetails" icon={<Gavel className="w-5 h-5" />}>
                <InfoGrid columns={3}>
                  <InfoItem label="Startgebot" value={formatPrice(auction.starting_bid)} icon={<Euro className="w-3 h-3" />} />
                  <InfoItem label="Reservepreis" value={formatPrice(auction.reserve_price)} icon={<Euro className="w-3 h-3" />} />
                  <InfoItem label="Soft-Close" value={`${auction.soft_close_extension_minutes} Min.`} icon={<Timer className="w-3 h-3" />} />
                  <InfoItem label="Gestartet" value={formatDate(auction.start_time)} icon={<Calendar className="w-3 h-3" />} />
                  <InfoItem label="Endet" value={formatDate(auction.end_time)} icon={<Calendar className="w-3 h-3" />} />
                  <InfoItem label="Erstellt" value={formatDate(auction.created_at)} icon={<Calendar className="w-3 h-3" />} />
                </InfoGrid>

                {auction.reserve_price && auction.current_bid && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/50">
                    {auction.current_bid >= auction.reserve_price ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm font-medium">Reservepreis erreicht</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          Reservepreis noch nicht erreicht (fehlen noch {formatPrice(auction.reserve_price - (auction.current_bid || 0))})
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </DetailSection>

              {/* Motorhome Info */}
              <DetailSection
                title="Fahrzeugdaten"
                icon={<Car className="w-5 h-5" />}
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/admin/motorhomes/${auction.motorhome?.id}`)}
                  >
                    Details anzeigen
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                }
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {/* Thumbnail */}
                  <div className="w-full sm:w-32 h-40 sm:h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {mainPhoto ? (
                      <img
                        src={mainPhoto.url}
                        alt={`${auction.motorhome?.manufacturer} ${auction.motorhome?.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <InfoGrid columns={3}>
                    <InfoItem label="Hersteller" value={auction.motorhome?.manufacturer} />
                    <InfoItem label="Modell" value={auction.motorhome?.model} />
                    <InfoItem label="Baujahr" value={auction.motorhome?.year} />
                    <InfoItem label="Kilometerstand" value={auction.motorhome?.mileage ? `${auction.motorhome.mileage.toLocaleString()} km` : "—"} />
                    <InfoItem label="Zustand" value={auction.motorhome?.condition} />
                    <InfoItem label="Aufbauart" value={auction.motorhome?.body_type} />
                    <InfoItem label="PLZ (Standort)" value={auction.motorhome?.postal_code || "—"} />
                    <InfoItem label="Stadt" value={auction.motorhome?.city || "—"} />
                    <InfoItem label="Verkaufsweg" value={
                      auction.motorhome?.sale_channel === 'instant_price' ? '⚡ Nur Festpreis'
                      : auction.motorhome?.sale_channel === 'auction' && auction.motorhome?.instant_price && Number(auction.motorhome.instant_price) > 0
                        ? '🔨 Auktion + Sofortkauf'
                      : auction.motorhome?.sale_channel === 'station' ? '📍 Ankaufstation'
                      : '🔨 Auktion'
                    } />
                    {auction.motorhome?.instant_price && Number(auction.motorhome.instant_price) > 0 && (
                      <InfoItem label={auction.motorhome?.sale_channel === 'instant_price' ? 'Festpreis' : 'Sofortpreis'} value={formatPrice(auction.motorhome.instant_price)} icon={<Euro className="w-3 h-3" />} />
                    )}
                  </InfoGrid>
                </div>
              </DetailSection>

              {/* Nachträge des Verkäufers */}
              {Array.isArray((auction as any)?.auction_addenda) && (auction as any).auction_addenda.length > 0 && (
                <DetailSection title="Nachträge des Verkäufers" icon={<FileText className="w-5 h-5 text-blue-600" />}>
                  <div className="space-y-3">
                    {[...(auction as any).auction_addenda]
                      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((item: any) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
                        >
                          <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Hinzugefügt am{" "}
                            {format(new Date(item.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                          </p>
                        </div>
                      ))}
                  </div>
                </DetailSection>
              )}

              {/* Bids Table */}
              <DetailSection title={`Gebote (${bidCount})`} icon={<TrendingUp className="w-5 h-5" />}>
                {sortedBids.length > 0 ? (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bieter</TableHead>
                        <TableHead>Betrag</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Zeitpunkt</TableHead>
                        {["active", "draft"].includes(auction.status) && (
                          <TableHead className="w-10"></TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBids.map((bid: any, index: number) => (
                        <TableRow key={bid.id} className={index === 0 ? "bg-green-50 dark:bg-green-950/20" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {bid.bidder?.first_name} {bid.bidder?.last_name}
                                {index === 0 && (
                                  <Badge className="ml-2" variant="default">
                                    Höchstgebot
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{bid.bidder?.email}</p>
                              {bid.bidder?.company_name && (
                                <p className="text-xs text-muted-foreground">{bid.bidder.company_name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{formatPrice(bid.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={bid.is_autobid ? "secondary" : "outline"}>
                              {bid.is_autobid ? "Auto" : "Manuell"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(bid.created_at)}
                          </TableCell>
                          {["active", "draft"].includes(auction.status) && (
                            <TableCell>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    disabled={deleteBidMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Gebot löschen?</AlertDialogTitle>
                                    <AlertDialogDescription className="space-y-2">
                                      <span className="block">
                                        Gebot über <strong>{formatPrice(bid.amount)}</strong> von{" "}
                                        <strong>{bid.bidder?.first_name} {bid.bidder?.last_name}</strong>{" "}
                                        {bid.bidder?.company_name && `(${bid.bidder.company_name})`} wird unwiderruflich gelöscht.
                                      </span>
                                      {index === 0 && sortedBids.length > 1 && (
                                        <span className="block text-amber-600">
                                          ⚠️ Das ist das Höchstgebot. Das neue Höchstgebot wird{" "}
                                          <strong>{formatPrice(sortedBids[1]?.amount)}</strong> von{" "}
                                          {sortedBids[1]?.bidder?.first_name} {sortedBids[1]?.bidder?.last_name}.
                                        </span>
                                      )}
                                      {index === 0 && sortedBids.length === 1 && (
                                        <span className="block text-amber-600">
                                          ⚠️ Das ist das einzige Gebot. Die Auktion hat danach keine Gebote mehr.
                                        </span>
                                      )}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteBidMutation.mutate(bid.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Gebot löschen
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gavel className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Noch keine Gebote vorhanden</p>
                  </div>
                )}
              </DetailSection>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Seller Info */}
              <DetailSection title="Verkäufer" icon={<User className="w-5 h-5" />}>
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-lg">
                      {auction.motorhome?.seller?.first_name} {auction.motorhome?.seller?.last_name}
                    </p>
                    {auction.motorhome?.seller?.company_name && (
                      <p className="text-sm text-muted-foreground">{auction.motorhome.seller.company_name}</p>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <a
                      href={`mailto:${auction.motorhome?.seller?.email}`}
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {auction.motorhome?.seller?.email}
                    </a>
                    {auction.motorhome?.seller?.phone && (
                      <a
                        href={`tel:${auction.motorhome.seller.phone}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        {auction.motorhome.seller.phone}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/admin/users/${auction.motorhome?.seller?.id}`)}
                    >
                      Profil anzeigen
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowPenaltyDialog(true)}
                      title="Vertragsstrafe erstellen (§ 8 Abs. 4 AGB)"
                    >
                      <Scale className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DetailSection>

              {/* Highest Bidder */}
              {highestBid && (
                <DetailSection title="Höchstbietender" icon={<TrendingUp className="w-5 h-5" />}>
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-lg">
                        {highestBid.bidder?.first_name} {highestBid.bidder?.last_name}
                      </p>
                      {highestBid.bidder?.company_name && (
                        <p className="text-sm text-muted-foreground">{highestBid.bidder.company_name}</p>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <p className="text-sm text-muted-foreground">Höchstgebot</p>
                      <p className="text-2xl font-bold text-green-600">{formatPrice(highestBid.amount)}</p>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <a
                        href={`mailto:${highestBid.bidder?.email}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        {highestBid.bidder?.email}
                      </a>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/admin/users/${highestBid.bidder?.id}`)}
                    >
                      Profil anzeigen
                    </Button>
                  </div>
                </DetailSection>
              )}

              {/* Photos Preview */}
              {photosArray.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Fotos ({photosArray.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {photosArray.slice(0, 6).map((photo: any, index: number) => (
                        <div key={photo.id} className="aspect-square rounded-md overflow-hidden bg-muted">
                          <img
                            src={photo.url}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {auction && (
        <AuctionEditDialog
          auction={auction}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* Seller Penalty Dialog */}
      {auction && (
        <CreateSellerPenaltyDialog
          open={showPenaltyDialog}
          onOpenChange={setShowPenaltyDialog}
          preSelectedSellerId={auction.motorhome?.seller?.id}
          preSelectedAuctionId={auction.id}
          preSelectedMotorhomeId={auction.motorhome?.id}
        />
      )}
    </AdminDetailLayout>
  );
}
