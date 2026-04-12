import { useState, useCallback } from "react";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, DollarSign, Key, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveData } from "@/hooks/useLiveData";
import { toast } from "sonner";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { format } from "date-fns";
import { de } from "date-fns/locale";
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

interface Appointment {
  id: string;
  appointment_date: string;
  duration_minutes: number;
  status: string;
  payment_method: string | null;
  payment_status: string;
  payment_amount: number | null;
  release_pin: string | null;
  notes: string | null;
  vehicles: {
    manufacturer: string;
    model: string;
    year: number;
  };
  purchase_stations: {
    name: string;
    city: string;
    address: string;
    phone: string;
  };
}

const MyAppointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    const sessionValid = await ensureValidRLSSession();
    if (!sessionValid) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          vehicles (manufacturer, model, year),
          purchase_stations (name, city, address, phone)
        `)
        .eq('seller_id', user?.id)
        .order('appointment_date', { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      logger.error('Error fetching appointments:', error);
      toast.error('Fehler beim Laden der Termine');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useLiveData(fetchAppointments, { enabled: !!user, pollingInterval: 0 });

  const cancelAppointment = async (appointmentId: string) => {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;
      toast.success('Termin erfolgreich storniert');
      fetchAppointments();
    } catch (error) {
      logger.error('Error cancelling appointment:', error);
      toast.error('Fehler beim Stornieren des Termins');
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      scheduled: { variant: "secondary", label: "Geplant" },
      confirmed: { variant: "default", label: "Bestätigt" },
      completed: { variant: "outline", label: "Abgeschlossen" },
      cancelled: { variant: "destructive", label: "Storniert" },
    };
    const { variant, label } = config[status] || { variant: "secondary", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPaymentBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      pending: { variant: "secondary", label: "Ausstehend" },
      paid: { variant: "default", label: "Bezahlt" },
      failed: { variant: "destructive", label: "Fehlgeschlagen" },
    };
    const { variant, label } = config[status] || { variant: "secondary", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const isPastAppointment = (date: string) => {
    return new Date(date) < new Date();
  };

  const canCancel = (appointment: Appointment) => {
    return appointment.status === 'scheduled' && !isPastAppointment(appointment.appointment_date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Meine Termine</h1>
        <p className="text-muted-foreground">
          Übersicht über Ihre gebuchten Übergabetermine
        </p>
      </div>

      {appointments.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Keine Termine vorhanden</h3>
          <p className="text-muted-foreground">
            Sie haben noch keine Übergabetermine gebucht
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <Card key={appointment.id} className={isPastAppointment(appointment.appointment_date) ? 'opacity-75' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      {appointment.vehicles?.manufacturer} {appointment.vehicles?.model}
                      {getStatusBadge(appointment.status)}
                    </CardTitle>
                    <CardDescription>
                      Termin-ID: {appointment.id.slice(0, 8)}
                    </CardDescription>
                  </div>
                  {canCancel(appointment) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Termin stornieren?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Möchten Sie diesen Termin wirklich stornieren? Diese Aktion kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => cancelAppointment(appointment.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Stornieren
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Date & Time */}
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium">Datum & Uhrzeit</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(appointment.appointment_date), "PPP 'um' HH:mm", { locale: de })}
                      </p>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium">Dauer</p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.duration_minutes} Minuten
                      </p>
                    </div>
                  </div>

                  {/* Station */}
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium">Station</p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.purchase_stations?.name}
                        <br />
                        {appointment.purchase_stations?.address}
                        <br />
                        {appointment.purchase_stations?.city}
                        <br />
                        Tel: {appointment.purchase_stations?.phone}
                      </p>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="flex items-start gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium">Zahlung</p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.payment_method === "cash" ? "Barzahlung" : "SEPA Instant"}
                        {" "}{getPaymentBadge(appointment.payment_status)}
                      </p>
                      {appointment.payment_amount && (
                        <p className="text-sm font-semibold text-primary mt-1">
                          {appointment.payment_amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Release PIN */}
                {appointment.release_pin && appointment.status === 'confirmed' && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Key className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Release-PIN</p>
                        <p className="text-2xl font-mono font-bold text-primary tracking-wider mt-1">
                          {appointment.release_pin}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Bitte geben Sie diese PIN bei der Übergabe an, um die Zahlung freizugeben
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {appointment.notes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-1">Ihre Notizen:</p>
                    <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAppointments;
