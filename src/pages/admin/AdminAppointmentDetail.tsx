/**
 * Admin Appointment Detail Page
 * Comprehensive view of appointment with timeline, motorhome info, and actions
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Car,
  Euro,
  CheckCircle2,
  XCircle,
  Play,
  FileText,
  Key,
  Mail,
  Phone,
  AlertTriangle,
  ExternalLink,
  Loader2,
  CreditCard,
  Timer,
  Building2,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { logger } from "@/lib/logger";

export default function AdminAppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isGeneratingPin, setIsGeneratingPin] = useState(false);

  // Fetch appointment with all related data
  const { data: appointment, isLoading, error } = useQuery({
    queryKey: ["adminAppointmentDetail", id],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          motorhome:motorhomes (
            id,
            manufacturer,
            model,
            year,
            body_type,
            mileage,
            condition,
            instant_price,
            reserve_price,
            motorhome_photos(url, display_order)
          ),
          station:purchase_stations (
            id,
            name,
            city,
            street,
            postal_code,
            phone,
            email
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch seller info separately
      const { data: seller } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, company_name")
        .eq("id", data.seller_id)
        .single();

      return {
        ...data,
        seller,
      };
    },
    enabled: !!id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["adminAppointmentDetail", id] });
    },
    onError: (error) => {
      logger.error("Update status error:", error);
      toast.error("Fehler beim Aktualisieren des Status");
    },
  });

  // Update payment status mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (paymentStatus: string) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

      const { error } = await supabase
        .from("appointments")
        .update({ payment_status: paymentStatus })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zahlungsstatus aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["adminAppointmentDetail", id] });
    },
    onError: (error) => {
      logger.error("Update payment status error:", error);
      toast.error("Fehler beim Aktualisieren des Zahlungsstatus");
    },
  });

  // Generate PIN mutation
  const generatePinMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingPin(true);
      const { data, error } = await invokeWithAuth("generate-appointment-pin", {
        body: { appointmentId: id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("PIN erfolgreich generiert");
      queryClient.invalidateQueries({ queryKey: ["adminAppointmentDetail", id] });
    },
    onError: (error) => {
      logger.error("Generate PIN error:", error);
      toast.error("Fehler beim Generieren des PINs");
    },
    onSettled: () => {
      setIsGeneratingPin(false);
    },
  });

  // Complete handover mutation
  const completeHandoverMutation = useMutation({
    mutationFn: async () => {
      const { error } = await invokeWithAuth("complete-handover", {
        body: { appointmentId: id },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Übergabe erfolgreich abgeschlossen");
      queryClient.invalidateQueries({ queryKey: ["adminAppointmentDetail", id] });
    },
    onError: (error) => {
      logger.error("Complete handover error:", error);
      toast.error("Fehler beim Abschließen der Übergabe");
    },
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Termin nicht gefunden</h2>
          <p className="mt-2 text-muted-foreground">
            Der angeforderte Termin existiert nicht.
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/appointments")}>
            Zurück zur Übersicht
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy", { locale: de });
  };

  const formatDateTime = (date: string | null) => {
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      scheduled: { label: "Geplant", variant: "outline" },
      confirmed: { label: "Bestätigt", variant: "secondary" },
      completed: { label: "Abgeschlossen", variant: "default" },
      cancelled: { label: "Abgesagt", variant: "destructive" },
    };
    return statusConfig[status] || { label: status, variant: "outline" };
  };

  const getPaymentStatusBadge = (status: string | null) => {
    if (!status) return { label: "Ausstehend", variant: "outline" as const };
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Ausstehend", variant: "outline" },
      paid: { label: "Bezahlt", variant: "default" },
      failed: { label: "Fehlgeschlagen", variant: "destructive" },
    };
    return statusConfig[status] || { label: status, variant: "outline" };
  };

  const mainPhoto = [...(appointment?.motorhome?.motorhome_photos || [])].sort(
    (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
  )[0];

  const copyPinToClipboard = () => {
    if (appointment?.release_pin) {
      navigator.clipboard.writeText(appointment.release_pin);
      toast.success("PIN in Zwischenablage kopiert");
    }
  };

  return (
    <AdminDetailLayout
      title={`Termin #${appointment?.id?.slice(0, 8) || ""}`}
      subtitle={appointment?.motorhome ? `${appointment.motorhome.manufacturer} ${appointment.motorhome.model}` : undefined}
      status={appointment ? getStatusBadge(appointment.status) : undefined}
      backUrl="/admin/appointments"
      backLabel="Alle Termine"
      isLoading={isLoading}
      icon={<Calendar className="w-6 h-6" />}
      actions={
        appointment && (
          <div className="flex gap-2">
            {appointment.status === "scheduled" && (
              <Button
                size="sm"
                onClick={() => updateStatusMutation.mutate("confirmed")}
                disabled={updateStatusMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Bestätigen
              </Button>
            )}
            {appointment.status === "confirmed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <Play className="w-4 h-4 mr-2" />
                    Übergabe abschließen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Übergabe abschließen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Die Übergabe wird als abgeschlossen markiert und das Übergabeprotokoll wird generiert.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => completeHandoverMutation.mutate()}>
                      Abschließen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {appointment.status !== "cancelled" && appointment.status !== "completed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <XCircle className="w-4 h-4 mr-2" />
                    Absagen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Termin absagen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Der Termin wird als abgesagt markiert. Der Verkäufer wird benachrichtigt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => updateStatusMutation.mutate("cancelled")}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Absagen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )
      }
    >
      {appointment && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label="Datum"
              value={formatDate(appointment.appointment_date)}
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatsCard
              label="Uhrzeit"
              value={format(new Date(appointment.appointment_date), "HH:mm", { locale: de })}
              icon={<Clock className="w-5 h-5" />}
            />
            <StatsCard
              label="Dauer"
              value={`${appointment.duration_minutes || 60} Min.`}
              icon={<Timer className="w-5 h-5" />}
            />
            <StatsCard
              label="Zahlung"
              value={getPaymentStatusBadge(appointment.payment_status).label}
              icon={<Euro className="w-5 h-5" />}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Timeline */}
              <DetailSection title="Status-Timeline" icon={<Clock className="w-5 h-5" />}>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
                  <div className="space-y-6">
                    {/* Scheduled */}
                    <div className="flex items-start gap-4">
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                        ["scheduled", "confirmed", "completed"].includes(appointment.status)
                          ? "bg-green-100 text-green-600"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">Termin geplant</p>
                        <p className="text-sm text-muted-foreground">{formatDateTime(appointment.created_at)}</p>
                      </div>
                    </div>

                    {/* Confirmed */}
                    <div className="flex items-start gap-4">
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                        ["confirmed", "completed"].includes(appointment.status)
                          ? "bg-green-100 text-green-600"
                          : appointment.status === "cancelled"
                          ? "bg-red-100 text-red-600"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {appointment.status === "cancelled" ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {appointment.status === "cancelled" ? "Abgesagt" : "Bestätigt"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {appointment.status === "scheduled" ? "Ausstehend" : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Completed */}
                    <div className="flex items-start gap-4">
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                        appointment.status === "completed"
                          ? "bg-green-100 text-green-600"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">Übergabe abgeschlossen</p>
                        <p className="text-sm text-muted-foreground">
                          {appointment.status === "completed" ? formatDateTime(appointment.updated_at) : "Ausstehend"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </DetailSection>

              {/* Motorhome Info */}
              <DetailSection
                title="Fahrzeug"
                icon={<Car className="w-5 h-5" />}
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/admin/motorhomes/${appointment.motorhome?.id}`)}
                  >
                    Details
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                }
              >
                <div className="flex gap-6">
                  {/* Thumbnail */}
                  <div className="w-40 h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {mainPhoto ? (
                      <img
                        src={mainPhoto.url}
                        alt={`${appointment.motorhome?.manufacturer} ${appointment.motorhome?.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Car className="w-10 h-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      {appointment.motorhome?.manufacturer} {appointment.motorhome?.model}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {appointment.motorhome?.year} • {appointment.motorhome?.body_type}
                    </p>
                    <InfoGrid columns={3}>
                      <InfoItem label="Zustand" value={appointment.motorhome?.condition} />
                      <InfoItem label="Kilometerstand" value={appointment.motorhome?.mileage ? `${appointment.motorhome.mileage.toLocaleString()} km` : "—"} />
                      <InfoItem label="Preis" value={formatPrice(appointment.motorhome?.instant_price || appointment.motorhome?.reserve_price)} />
                    </InfoGrid>
                  </div>
                </div>
              </DetailSection>

              {/* Payment Info */}
              <DetailSection title="Zahlung" icon={<CreditCard className="w-5 h-5" />}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <InfoGrid columns={2}>
                      <InfoItem label="Betrag" value={formatPrice(appointment.payment_amount)} icon={<Euro className="w-3 h-3" />} />
                      <InfoItem label="Methode" value={appointment.payment_method || "—"} />
                    </InfoGrid>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Zahlungsstatus ändern</p>
                    <Select
                      value={appointment.payment_status || "pending"}
                      onValueChange={(value) => updatePaymentMutation.mutate(value)}
                      disabled={updatePaymentMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Ausstehend</SelectItem>
                        <SelectItem value="paid">Bezahlt</SelectItem>
                        <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DetailSection>

              {/* Notes */}
              {appointment.notes && (
                <DetailSection title="Notizen" icon={<FileText className="w-5 h-5" />}>
                  <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
                </DetailSection>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Release PIN */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Freigabe-PIN
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {appointment.release_pin ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-primary/10 text-center">
                        <p className="text-3xl font-mono font-bold tracking-widest text-primary">
                          {appointment.release_pin}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={copyPinToClipboard}>
                          <Copy className="w-4 h-4 mr-2" />
                          Kopieren
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => generatePinMutation.mutate()}
                          disabled={isGeneratingPin}
                        >
                          {isGeneratingPin ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Neu
                        </Button>
                      </div>
                      {appointment.pin_generated_at && (
                        <p className="text-xs text-muted-foreground text-center">
                          Generiert: {formatDateTime(appointment.pin_generated_at)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        Noch kein PIN generiert
                      </p>
                      <Button
                        onClick={() => generatePinMutation.mutate()}
                        disabled={isGeneratingPin}
                        className="w-full"
                      >
                        {isGeneratingPin ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="w-4 h-4 mr-2" />
                        )}
                        PIN generieren
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Seller Info */}
              <DetailSection title="Verkäufer" icon={<User className="w-5 h-5" />}>
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-lg">
                      {appointment.seller?.first_name} {appointment.seller?.last_name}
                    </p>
                    {appointment.seller?.company_name && (
                      <p className="text-sm text-muted-foreground">{appointment.seller.company_name}</p>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <a
                      href={`mailto:${appointment.seller?.email}`}
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {appointment.seller?.email}
                    </a>
                    {appointment.seller?.phone && (
                      <a
                        href={`tel:${appointment.seller.phone}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        {appointment.seller.phone}
                      </a>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/admin/users/${appointment.seller?.id}`)}
                  >
                    Profil anzeigen
                  </Button>
                </div>
              </DetailSection>

              {/* Station Info */}
              <DetailSection title="Station" icon={<Building2 className="w-5 h-5" />}>
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold">{appointment.station?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.station?.street}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.station?.postal_code} {appointment.station?.city}
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    {appointment.station?.phone && (
                      <a
                        href={`tel:${appointment.station.phone}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        {appointment.station.phone}
                      </a>
                    )}
                    {appointment.station?.email && (
                      <a
                        href={`mailto:${appointment.station.email}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        {appointment.station.email}
                      </a>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/admin/stations`)}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Station verwalten
                  </Button>
                </div>
              </DetailSection>

              {/* Handover Protocol */}
              {appointment.handover_protocol_url && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Übergabeprotokoll
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" asChild>
                      <a href={appointment.handover_protocol_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        PDF öffnen
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminDetailLayout>
  );
}
