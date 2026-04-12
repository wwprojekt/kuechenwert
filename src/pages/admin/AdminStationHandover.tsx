import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { logger } from "@/lib/logger";
import { CheckCircle2, AlertCircle, Key, DollarSign, FileText } from "lucide-react";

const AdminStationHandover = () => {
  const [appointmentId, setAppointmentId] = useState("");
  const [pin, setPin] = useState("");
  const [generatedPin, setGeneratedPin] = useState("");
  const [verifiedAppointment, setVerifiedAppointment] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGeneratePin = async () => {
    if (!appointmentId) {
      toast.error("Bitte Termin-ID eingeben");
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await invokeWithAuth('generate-appointment-pin', {
        body: { appointment_id: appointmentId },
      });

      if (error) throw error;

      setGeneratedPin(data.pin);
      toast.success("PIN erfolgreich generiert");
    } catch (error) {
      logger.error('Error generating PIN:', error);
      toast.error("Fehler beim Generieren der PIN");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!appointmentId || !pin) {
      toast.error("Bitte Termin-ID und PIN eingeben");
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-appointment-pin', {
        body: { appointment_id: appointmentId, pin }
      });

      if (error) throw error;

      if (data.success) {
        const sessionValid = await ensureValidRLSSession();
        if (!sessionValid) { toast.error("Session abgelaufen"); return; }

        // Fetch appointment details
        const { data: appointment, error: fetchError } = await supabase
          .from('appointments')
          .select('*, vehicles(*), purchase_stations(*)')
          .eq('id', appointmentId)
          .single();

        if (fetchError) throw fetchError;

        setVerifiedAppointment(appointment);
        setPaymentAmount(appointment.vehicles.instant_price?.toString() || "");
        toast.success("PIN erfolgreich verifiziert");
      } else {
        toast.error(data.message || "Ungültige PIN");
      }
    } catch (error) {
      logger.error('Error verifying PIN:', error);
      toast.error("Fehler bei der PIN-Verifizierung");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteHandover = async () => {
    if (!verifiedAppointment || !paymentAmount) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }

    setIsProcessing(true);
    try {
      const { data: _data, error } = await invokeWithAuth('complete-handover', {
        body: {
          appointment_id: appointmentId,
          payment_method: paymentMethod,
          payment_amount: parseFloat(paymentAmount),
          protocol_data: {
            notes,
            completed_by: 'station_staff',
            completed_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;

      toast.success("Übergabe erfolgreich abgeschlossen!");
      
      // Reset form
      setAppointmentId("");
      setPin("");
      setGeneratedPin("");
      setVerifiedAppointment(null);
      setPaymentAmount("");
      setNotes("");
    } catch (error) {
      logger.error('Error completing handover:', error);
      toast.error("Fehler beim Abschließen der Übergabe");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Fahrzeugübergabe</h1>
        <p className="text-muted-foreground mt-2">
          Verwalten Sie Fahrzeugübergaben an Ankaufstationen
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PIN Generation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              PIN Generierung
            </CardTitle>
            <CardDescription>
              Generieren Sie einen 6-stelligen Freigabe-PIN für den Termin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="appointmentId">Termin-ID</Label>
              <Input
                id="appointmentId"
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
                placeholder="UUID des Termins"
              />
            </div>
            <Button 
              onClick={handleGeneratePin} 
              disabled={isProcessing || !appointmentId}
              className="w-full"
            >
              PIN Generieren
            </Button>
            {generatedPin && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">Generierter PIN:</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary tracking-wider">{generatedPin}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Gültig für 24 Stunden
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PIN Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              PIN Verifizierung
            </CardTitle>
            <CardDescription>
              Verifizieren Sie den PIN des Verkäufers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="verifyAppointmentId">Termin-ID</Label>
              <Input
                id="verifyAppointmentId"
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
                placeholder="UUID des Termins"
              />
            </div>
            <div>
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="6-stelliger PIN"
                maxLength={6}
              />
            </div>
            <Button 
              onClick={handleVerifyPin} 
              disabled={isProcessing || !appointmentId || !pin}
              className="w-full"
            >
              PIN Verifizieren
            </Button>
            {verifiedAppointment && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Verifiziert</span>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Fahrzeug:</strong> {verifiedAppointment.vehicles.manufacturer} {verifiedAppointment.vehicles.model}</p>
                  <p><strong>Station:</strong> {verifiedAppointment.purchase_stations.name}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Handover Completion */}
      {verifiedAppointment && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Übergabe Abschließen
            </CardTitle>
            <CardDescription>
              Bestätigen Sie die Zahlung und schließen Sie die Übergabe ab
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Zahlungsmethode</Label>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="cursor-pointer">Barzahlung</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sepa_instant" id="sepa" />
                    <Label htmlFor="sepa" className="cursor-pointer">SEPA Instant</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="paymentAmount">Betrag (€)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Anmerkungen</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Zusätzliche Notizen zur Übergabe..."
                rows={4}
              />
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleCompleteHandover}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <DollarSign className="h-5 w-5 mr-2" />
                Übergabe Abschließen
              </Button>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">Wichtig:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Überprüfen Sie alle Fahrzeugdokumente</li>
                    <li>Bestätigen Sie den Fahrzeugzustand</li>
                    <li>Dokumentieren Sie sichtbare Schäden</li>
                    <li>Händigen Sie dem Verkäufer die Zahlungsbestätigung aus</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminStationHandover;
