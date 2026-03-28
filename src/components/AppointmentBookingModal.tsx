import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { de } from "date-fns/locale";
import { format } from "date-fns";
import { Clock, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { trackTerminbuchung, setEnhancedConversionData } from "@/lib/gadsConversionService";
import { trackMetaSchedule } from "@/lib/metaPixelService";

interface AppointmentBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motorhomeId: string;
  stationId?: string;
}

interface PurchaseStation {
  id: string;
  name: string;
  city: string;
}

export const AppointmentBookingModal = ({
  open,
  onOpenChange,
  motorhomeId,
  stationId,
}: AppointmentBookingModalProps) => {
  const { user } = useAuth();
  const [stations, setStations] = useState<PurchaseStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>(stationId || "");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_stations')
        .select('id, name, city')
        .eq('is_active', true)
        .order('city');

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      logger.error('Error fetching stations:', error);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const handleBooking = async () => {
    if (!selectedStation || !selectedDate || !selectedTime || !paymentMethod) {
      toast.error("Bitte füllen Sie alle erforderlichen Felder aus");
      return;
    }

    setLoading(true);
    try {
      const appointmentDateTime = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':');
      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await supabase
        .from('appointments')
        .insert({
          motorhome_id: motorhomeId,
          station_id: selectedStation,
          seller_id: user?.id,
          appointment_date: appointmentDateTime.toISOString(),
          duration_minutes: 60,
          payment_method: paymentMethod,
          payment_status: 'pending',
          status: 'scheduled',
          notes,
        });

      if (error) throw error;

      // Send confirmation email
      try {
        await supabase.functions.invoke('send-appointment-confirmation', {
          body: {
            appointmentId: motorhomeId,
            userEmail: user?.email,
          },
        });
      } catch (emailError) {
        logger.error('Email sending failed:', emailError);
      }

      // Google Ads: Enhanced Conversions + Terminbuchung (Primäre Conversion)
      if (user?.email) {
        await setEnhancedConversionData({ email: user.email });
      }
      const stationName = stations.find(s => s.id === selectedStation)?.name || '';
      await trackTerminbuchung(stationName);

      // Meta Pixel: Schedule Event
      trackMetaSchedule({ content_name: stationName || 'Ankaufstation-Termin' });

      toast.success("Termin erfolgreich gebucht!");
      onOpenChange(false);
    } catch (error: any) {
      logger.error('Error booking appointment:', error);
      toast.error("Fehler beim Buchen des Termins");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Übergabetermin vereinbaren
          </DialogTitle>
          <DialogDescription>
            Wählen Sie einen Termin und eine Station für die Übergabe Ihres Wohnmobils
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Station Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Ankaufstation
            </Label>
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger>
                <SelectValue placeholder="Station auswählen" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    {station.name} - {station.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Datum
            </Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={de}
              disabled={(date) => {
                // Disable past dates and weekends
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today || date.getDay() === 0 || date.getDay() === 6;
              }}
              className="rounded-md border w-full"
            />
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Uhrzeit
            </Label>
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Uhrzeit auswählen" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {generateTimeSlots().map((time) => (
                  <SelectItem key={time} value={time}>
                    {time} Uhr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Zahlungsmethode</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Zahlungsmethode auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Barzahlung</SelectItem>
                <SelectItem value="sepa_instant">SEPA Instant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notizen (optional)</Label>
            <Textarea
              placeholder="Besondere Hinweise oder Anfragen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Summary */}
          {selectedDate && selectedTime && selectedStation && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="font-medium">Terminzusammenfassung:</p>
              <p className="text-sm text-muted-foreground">
                📅 {format(selectedDate, "PPP", { locale: de })} um {selectedTime} Uhr
              </p>
              <p className="text-sm text-muted-foreground">
                📍 {stations.find(s => s.id === selectedStation)?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                💳 {paymentMethod === "cash" ? "Barzahlung" : "SEPA Instant"}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleBooking} disabled={loading}>
            {loading ? "Wird gebucht..." : "Termin buchen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
