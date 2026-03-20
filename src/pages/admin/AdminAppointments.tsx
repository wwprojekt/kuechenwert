import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, DollarSign, Key, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  motorhome_id: string;
  station_id: string;
  seller_id: string;
  motorhomes: {
    manufacturer: string;
    model: string;
    year: number;
  };
  purchase_stations: {
    name: string;
    city: string;
  };
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

const AdminAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const query = supabase
        .from('appointments')
        .select(`
          *,
          motorhomes (manufacturer, model, year),
          purchase_stations (name, city)
        `)
        .order('appointment_date', { ascending: false });

      const { data: appointmentsData, error } = await query;
      if (error) throw error;

      // Batch-fetch all seller profiles in a single query instead of N+1
      const sellerIds = [...new Set((appointmentsData || []).map(apt => apt.seller_id).filter(Boolean))];
      
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};
      if (sellerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', sellerIds);
        
        profilesMap = (profilesData || []).reduce((acc, p) => {
          acc[p.id] = { first_name: p.first_name, last_name: p.last_name, email: p.email };
          return acc;
        }, {} as typeof profilesMap);
      }

      const enrichedAppointments = (appointmentsData || []).map(apt => ({
        ...apt,
        profiles: profilesMap[apt.seller_id] || { first_name: null, last_name: null, email: '' }
      }));

      setAppointments(enrichedAppointments as any);
    } catch (error) {
      logger.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReleasePin = async (appointmentId: string) => {
    try {
      const { data, error } = await supabase.rpc('generate_release_pin');
      if (error) throw error;

      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          release_pin: data,
          pin_generated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      toast({ title: "PIN generiert", description: `Release-PIN: ${data}` });
      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);

      if (error) throw error;
      toast({ title: `Status aktualisiert: ${status}` });
      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updatePaymentStatus = async (appointmentId: string, paymentStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ payment_status: paymentStatus })
        .eq('id', appointmentId);

      if (error) throw error;
      toast({ title: `Zahlungsstatus aktualisiert: ${paymentStatus}` });
      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      scheduled: "secondary",
      confirmed: "default",
      completed: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const getPaymentBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      paid: "default",
      failed: "destructive",
    };
    const labels: Record<string, string> = {
      pending: "Ausstehend",
      paid: "Bezahlt",
      failed: "Fehlgeschlagen",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === "all") return true;
    return apt.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="w-8 h-8" />
            Termine
          </h1>
          <p className="text-muted-foreground mt-1">
            Verwaltung aller Übergabetermine
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          Alle
        </Button>
        <Button
          variant={filter === "scheduled" ? "default" : "outline"}
          onClick={() => setFilter("scheduled")}
        >
          Geplant
        </Button>
        <Button
          variant={filter === "confirmed" ? "default" : "outline"}
          onClick={() => setFilter("confirmed")}
        >
          Bestätigt
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          onClick={() => setFilter("completed")}
        >
          Abgeschlossen
        </Button>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Lade Termine...</p>
          </Card>
        ) : filteredAppointments.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Keine Termine gefunden</p>
          </Card>
        ) : (
          filteredAppointments.map((appointment) => (
            <Card key={appointment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {appointment.motorhomes?.manufacturer} {appointment.motorhomes?.model}
                      {getStatusBadge(appointment.status)}
                    </CardTitle>
                    <CardDescription>
                      Termin-ID: {appointment.id.slice(0, 8)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/appointments/${appointment.id}`)}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                    {appointment.status === "scheduled" && (
                      <Button
                        size="sm"
                        onClick={() => updateAppointmentStatus(appointment.id, "confirmed")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Bestätigen
                      </Button>
                    )}
                    {appointment.status === "confirmed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAppointmentStatus(appointment.id, "completed")}
                      >
                        Abschließen
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        {appointment.purchase_stations?.name}, {appointment.purchase_stations?.city}
                      </p>
                    </div>
                  </div>

                  {/* Seller */}
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium">Verkäufer</p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.profiles?.first_name} {appointment.profiles?.last_name}
                        <br />
                        {appointment.profiles?.email}
                      </p>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="flex items-start gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm font-medium">Zahlung</p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.payment_amount 
                          ? `${appointment.payment_amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`
                          : "Betrag nicht festgelegt"
                        }
                        <br />
                        {appointment.payment_method === "cash" ? "Barzahlung" : "SEPA Instant"}
                        {" "}{getPaymentBadge(appointment.payment_status)}
                      </p>
                    </div>
                  </div>

                  {/* Release PIN */}
                  <div className="flex items-start gap-2">
                    <Key className="w-4 h-4 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Release-PIN</p>
                      {appointment.release_pin ? (
                        <p className="text-sm font-mono text-primary">{appointment.release_pin}</p>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateReleasePin(appointment.id)}
                          className="mt-1"
                        >
                          PIN generieren
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Status Update */}
                {appointment.payment_status === "pending" && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updatePaymentStatus(appointment.id, "paid")}
                    >
                      Als bezahlt markieren
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updatePaymentStatus(appointment.id, "failed")}
                    >
                      Zahlung fehlgeschlagen
                    </Button>
                  </div>
                )}

                {/* Notes */}
                {appointment.notes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-1">Notizen:</p>
                    <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminAppointments;