import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Car, Clock, TrendingUp, RotateCw, X, Play, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
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
import { AuctionEditDialog } from "@/components/admin/AuctionEditDialog";

export default function AdminAuctions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: auctions, isLoading } = useQuery({
    queryKey: ["adminAuctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          motorhome:motorhomes (
            id,
            manufacturer,
            model,
            year,
            motorhome_photos(url, display_order),
            seller:profiles!left (
              first_name,
              last_name,
              email
            )
          ),
          bids (count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const checkExpiredAuctionsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-expired-auctions', {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.successCount} Auktionen erfolgreich geschlossen`);
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
    },
    onError: (error: any) => {
      toast.error("Fehler beim Prüfen abgelaufener Auktionen");
      logger.error(error);
    },
  });

  const closeAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      const { data, error } = await supabase.functions.invoke('close-auction', {
        body: { auctionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich geschlossen");
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
    },
    onError: (error: any) => {
      toast.error("Fehler beim Schließen der Auktion");
      logger.error(error);
    },
  });

  const activateAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      // Set auction to active with end_time 7 days from now
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 7);
      
      const { error } = await supabase
        .from('auctions')
        .update({ 
          status: 'active',
          end_time: endTime.toISOString(),
          start_time: new Date().toISOString()
        })
        .eq('id', auctionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auktion erfolgreich aktiviert");
      queryClient.invalidateQueries({ queryKey: ["adminAuctions"] });
    },
    onError: (error: any) => {
      toast.error("Fehler beim Aktivieren der Auktion");
      logger.error(error);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Laufend</Badge>;
      case "sold":
        return <Badge className="bg-green-500 hover:bg-green-600">Verkauft</Badge>;
      case "ended":
        return <Badge className="bg-red-500 hover:bg-red-600">Nicht verkauft</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Abgebrochen</Badge>;
      case "draft":
        return <Badge variant="secondary">Entwurf</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Auktionsverwaltung</h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle Auktionen auf der Plattform
          </p>
        </div>
        <Button
          onClick={() => checkExpiredAuctionsMutation.mutate()}
          disabled={checkExpiredAuctionsMutation.isPending}
          className="gap-2"
        >
          <RotateCw className={`w-4 h-4 ${checkExpiredAuctionsMutation.isPending ? 'animate-spin' : ''}`} />
          Abgelaufene Auktionen prüfen
        </Button>
      </div>

      <Card className="border-2 hover:border-primary/20 transition-smooth overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Bild</TableHead>
              <TableHead>Fahrzeug</TableHead>
              <TableHead>Verkäufer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aktuelles Gebot</TableHead>
              <TableHead>Gebote</TableHead>
              <TableHead>Endet am</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Lädt...
                </TableCell>
              </TableRow>
            ) : auctions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Keine Auktionen gefunden
                </TableCell>
              </TableRow>
            ) : (
              auctions?.map((auction) => {
                const firstPhoto = auction.motorhome?.motorhome_photos
                  ?.sort((a: any, b: any) => a.display_order - b.display_order)[0]?.url;

                return (
                  <TableRow 
                    key={auction.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/auctions/${auction.id}`)}
                  >
                    <TableCell>
                      <div className="w-16 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {firstPhoto ? (
                          <img 
                            src={firstPhoto}
                            alt={`${auction.motorhome?.manufacturer} ${auction.motorhome?.model}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Car className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {auction.motorhome?.manufacturer} {auction.motorhome?.model}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {auction.motorhome?.year}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">
                          {auction.motorhome?.seller?.first_name}{" "}
                          {auction.motorhome?.seller?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {auction.motorhome?.seller?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(auction.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="font-medium">
                          €{Number(auction.current_bid || auction.starting_bid).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{auction.bids?.[0]?.count || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      {auction.end_time ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-4 h-4" />
                          {format(new Date(auction.end_time), "dd.MM.yyyy HH:mm", {
                            locale: de,
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAuction(auction);
                            setShowEditDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {auction.status === "draft" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
                                <Play className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Auktion aktivieren?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Die Auktion wird für 7 Tage aktiviert und ist dann auf der Startseite sichtbar.
                                  Händler können ab sofort Gebote abgeben.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => activateAuctionMutation.mutate(auction.id)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Auktion aktivieren
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {auction.status === "active" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <X className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Auktion jetzt schließen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Diese Aktion wird die Auktion sofort beenden und den Gewinner bestimmen, falls vorhanden.
                                  Dies kann nicht rückgängig gemacht werden.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => closeAuctionMutation.mutate(auction.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Auktion schließen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Dialog */}
      <AuctionEditDialog
        auction={selectedAuction}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
    </div>
  );
}
