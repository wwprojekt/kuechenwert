import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  DollarSign,
  Key,
  CheckCircle2,
  ExternalLink,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AdminPagination, paginateArray } from "@/components/admin/AdminPagination";
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";

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
  kitchen_id: string;
  station_id: string;
  seller_id: string;
  kitchens: {
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

const PAGE_SIZE = 20;

const AdminAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "termine",
    columns: [
      { key: "id", label: "Termin-ID" },
      {
        key: "appointment_date",
        label: "Datum & Uhrzeit",
        format: (v: string) =>
          v ? format(new Date(v), "dd.MM.yyyy HH:mm", { locale: de }) : "",
      },
      { key: "status", label: "Status" },
      { key: "duration_minutes", label: "Dauer (Min.)" },
      {
        key: "kitchens",
        label: "Fahrzeug",
        format: (_: Appointment["kitchens"], row: Appointment) =>
          [row.kitchens?.manufacturer, row.kitchens?.model, row.kitchens?.year]
            .filter(Boolean)
            .join(" "),
      },
      {
        key: "purchase_stations",
        label: "Station",
        format: (_: Appointment["purchase_stations"], row: Appointment) =>
          [row.purchase_stations?.name, row.purchase_stations?.city].filter(Boolean).join(", "),
      },
      {
        key: "profiles",
        label: "Verkäufer",
        format: (_: Appointment["profiles"], row: Appointment) =>
          `${row.profiles?.first_name || ""} ${row.profiles?.last_name || ""}`.trim(),
      },
      {
        key: "profiles",
        label: "E-Mail Verkäufer",
        format: (_: Appointment["profiles"], row: Appointment) => row.profiles?.email || "",
      },
      { key: "payment_method", label: "Zahlungsart" },
      { key: "payment_status", label: "Zahlungsstatus" },
      {
        key: "payment_amount",
        label: "Betrag (EUR)",
        format: (v: number | null) =>
          v != null ? Number(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
      },
      { key: "release_pin", label: "Release-PIN" },
      { key: "notes", label: "Notizen" },
    ],
  });

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const fetchAppointments = async () => {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      const query = supabase
        .from('appointments')
        .select(`
          *,
          kitchens (manufacturer, model, year),
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
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

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
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

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
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

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

  const filteredAppointments = useMemo(() => {
    let list = appointments.filter((apt) => {
      if (filter === "all") return true;
      return apt.status === filter;
    });

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((apt) => {
      const vehicle = `${apt.kitchens?.manufacturer ?? ""} ${apt.kitchens?.model ?? ""} ${apt.kitchens?.year ?? ""}`.toLowerCase();
      const seller = `${apt.profiles?.first_name ?? ""} ${apt.profiles?.last_name ?? ""} ${apt.profiles?.email ?? ""}`.toLowerCase();
      const station = `${apt.purchase_stations?.name ?? ""} ${apt.purchase_stations?.city ?? ""}`.toLowerCase();
      return vehicle.includes(q) || seller.includes(q) || station.includes(q);
    });
  }, [appointments, filter, searchQuery]);

  const paginatedAppointments = useMemo(
    () => paginateArray(filteredAppointments, currentPage, PAGE_SIZE),
    [filteredAppointments, currentPage]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Calendar className="w-8 h-8" />
            Termine
          </h1>
          <p className="text-muted-foreground mt-1">
            Verwaltung aller Übergabetermine
          </p>
        </div>
        <ExportButton
          onExportCSV={() => exportCSV(filteredAppointments)}
          onExportExcel={() => exportExcel(filteredAppointments)}
          isExporting={isExporting}
          size="sm"
        />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          Alle
        </Button>
        <Button
          size="sm"
          variant={filter === "scheduled" ? "default" : "outline"}
          onClick={() => setFilter("scheduled")}
        >
          Geplant
        </Button>
        <Button
          size="sm"
          variant={filter === "confirmed" ? "default" : "outline"}
          onClick={() => setFilter("confirmed")}
        >
          Bestätigt
        </Button>
        <Button
          size="sm"
          variant={filter === "completed" ? "default" : "outline"}
          onClick={() => setFilter("completed")}
        >
          Abgeschlossen
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Suche nach Fahrzeug, Verkäufer, Station..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
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
          paginatedAppointments.map((appointment) => (
            <Card key={appointment.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                      <span className="break-words">
                        {appointment.kitchens?.manufacturer} {appointment.kitchens?.model}
                      </span>
                      {getStatusBadge(appointment.status)}
                    </CardTitle>
                    <CardDescription>
                      Termin-ID: {appointment.id.slice(0, 8)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
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

      {!loading && filteredAppointments.length > PAGE_SIZE && (
        <AdminPagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={filteredAppointments.length}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

export default AdminAppointments;