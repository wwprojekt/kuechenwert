import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, Clock, MapPin, Phone, Mail, Building2 } from "lucide-react";

interface Station {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  accepts_cash_payment: boolean;
  accepts_sepa_instant: boolean;
}

interface AppointmentStepProps {
  formData: any;
  updateFormData: (data: any) => void;
}

export const AppointmentStep = ({ formData, updateFormData }: AppointmentStepProps) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    formData.appointmentDate ? new Date(formData.appointmentDate) : undefined
  );

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00"
  ];

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_stations')
        .select('*')
        .eq('is_active', true)
        .order('city');

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      logger.error('Error fetching stations:', error);
      toast.error('Fehler beim Laden der Stationen');
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    updateFormData({ appointmentDate: date?.toISOString() });
  };

  const handleTimeSelect = (time: string) => {
    updateFormData({ appointmentTime: time });
  };

  const handleStationSelect = (stationId: string) => {
    updateFormData({ stationId });
  };

  const selectedStation = stations.find(s => s.id === formData.stationId);

  if (loading) {
    return (
      <Card className="p-8">
        <p className="text-center text-muted-foreground">Lade Stationen...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          Termin vereinbaren
        </h2>
        <p className="text-muted-foreground">
          Wählen Sie eine Ankaufstation und einen Termin für die Übergabe
        </p>
      </div>

      {/* Station Selection */}
      <Card className="p-6">
        <Label className="text-lg font-semibold mb-4 block flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Ankaufstation wählen
        </Label>
        <RadioGroup
          value={formData.stationId || ""}
          onValueChange={handleStationSelect}
          className="space-y-4"
        >
          {stations.map((station) => (
            <div key={station.id}>
              <RadioGroupItem
                value={station.id}
                id={station.id}
                className="peer sr-only"
              />
              <Label
                htmlFor={station.id}
                className="flex flex-col gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
              >
                <div className="font-semibold text-lg">{station.name}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{station.address}, {station.city}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{station.phone}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{station.email}</span>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  {station.accepts_cash_payment && (
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                      Barzahlung
                    </span>
                  )}
                  {station.accepts_sepa_instant && (
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                      SEPA Instant
                    </span>
                  )}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </Card>

      {/* Date & Time Selection */}
      {formData.stationId && (
        <>
          <Card className="p-6">
            <Label className="text-lg font-semibold mb-4 block flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Datum auswählen
            </Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={de}
              disabled={(date) => date < new Date() || date.getDay() === 0}
              className="rounded-md border"
            />
          </Card>

          {selectedDate && (
            <Card className="p-6">
              <Label className="text-lg font-semibold mb-4 block flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Uhrzeit auswählen
              </Label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {timeSlots.map((time) => (
                  <Button
                    key={time}
                    type="button"
                    variant={formData.appointmentTime === time ? "default" : "outline"}
                    onClick={() => handleTimeSelect(time)}
                    className="w-full"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Contact Details */}
      {formData.stationId && selectedDate && formData.appointmentTime && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Kontaktdaten</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customerName">Name *</Label>
              <Input
                id="customerName"
                value={formData.customerName || ""}
                onChange={(e) => updateFormData({ customerName: e.target.value })}
                placeholder="Ihr vollständiger Name"
              />
            </div>
            <div>
              <Label htmlFor="customerPhone">Telefon *</Label>
              <Input
                id="customerPhone"
                type="tel"
                value={formData.customerPhone || ""}
                onChange={(e) => updateFormData({ customerPhone: e.target.value })}
                placeholder="+49 123 456789"
              />
            </div>
            <div>
              <Label htmlFor="customerEmail">E-Mail *</Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail || ""}
                onChange={(e) => updateFormData({ customerEmail: e.target.value })}
                placeholder="ihre@email.de"
              />
            </div>
            <div>
              <Label htmlFor="appointmentNotes">Anmerkungen (optional)</Label>
              <Textarea
                id="appointmentNotes"
                rows={4}
                value={formData.appointmentNotes || ""}
                onChange={(e) => updateFormData({ appointmentNotes: e.target.value })}
                placeholder="Besondere Wünsche oder Informationen..."
              />
            </div>
          </div>
        </Card>
      )}

      {/* Summary */}
      {selectedStation && selectedDate && formData.appointmentTime && (
        <Card className="p-6 bg-primary/5 border-primary/20">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Terminübersicht
          </h3>
          <div className="space-y-2 text-sm">
            <p><strong>Station:</strong> {selectedStation.name}</p>
            <p><strong>Adresse:</strong> {selectedStation.address}, {selectedStation.city}</p>
            <p><strong>Datum:</strong> {format(selectedDate, 'PPP', { locale: de })}</p>
            <p><strong>Uhrzeit:</strong> {formData.appointmentTime} Uhr</p>
          </div>
        </Card>
      )}
    </div>
  );
};
