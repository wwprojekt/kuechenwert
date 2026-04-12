import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { MessageCircle, Send } from "lucide-react";
import { z } from "zod";

const questionSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail-Adresse"),
  question: z.string().trim().min(5, "Bitte geben Sie Ihre Frage ein (mind. 5 Zeichen)"),
});

interface VehicleQuestionFormProps {
  vehicleId: string;
  vehicleTitle: string;
}

const RATE_LIMIT_KEY = 'vq_rate_limit';
const MAX_QUESTIONS_PER_HOUR = 3;
const COOLDOWN_MS = 60 * 60 * 1000; // 1 Stunde

function checkRateLimit(): boolean {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (!stored) return true;
    const { count, timestamp } = JSON.parse(stored);
    if (Date.now() - timestamp > COOLDOWN_MS) return true;
    return count < MAX_QUESTIONS_PER_HOUR;
  } catch {
    return true;
  }
}

function incrementRateLimit(): void {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    let count = 1;
    let timestamp = Date.now();
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.timestamp <= COOLDOWN_MS) {
        count = parsed.count + 1;
        timestamp = parsed.timestamp;
      }
    }
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ count, timestamp }));
  } catch {
    // localStorage nicht verfügbar - ignorieren
  }
}

export function VehicleQuestionForm({ vehicleId, vehicleTitle }: VehicleQuestionFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    question: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate-Limiting: Max 3 Fragen pro Stunde
    if (!checkRateLimit()) {
      toast({
        title: "Bitte warten",
        description: "Sie haben bereits mehrere Fragen gestellt. Bitte versuchen Sie es später erneut.",
        variant: "destructive",
      });
      return;
    }

    try {
      questionSchema.parse({
        email: formData.email || user?.email || "",
        question: formData.question,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Bitte prüfen Sie Ihre Eingaben",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      if (user) {
        const sessionValid = await ensureValidRLSSession();
        if (!sessionValid) return;
      }

      const { error } = await supabase.from("vehicle_questions").insert({
        vehicle_id: vehicleId,
        questioner_id: user?.id || null,
        questioner_name: formData.name || (user?.email?.split("@")[0] || null),
        questioner_email: formData.email || user?.email || "",
        question: formData.question.trim(),
      });

      if (error) throw error;

      // Rate-Limit-Zähler erhöhen
      incrementRateLimit();

      // Admin-Benachrichtigung über neue Fahrzeugfrage senden (fire-and-forget)
      supabase.functions.invoke("notify-vehicle-question", {
        body: {
          vehicle_title: vehicleTitle,
          questioner_name: formData.name || user?.email?.split("@")[0] || "Unbekannt",
          questioner_email: formData.email || user?.email || "",
          question: formData.question.trim(),
        },
      }).then(({ error }) => {
        if (error) console.error("Admin-Benachrichtigung invoke-Fehler:", error);
      }).catch((err) => console.error("Admin-Benachrichtigung fehlgeschlagen:", err));

      toast({
        title: "Frage gesendet",
        description: "Ihre Frage wurde erfolgreich übermittelt. Wir werden uns in Kürze bei Ihnen melden.",
      });

      setFormData({ name: "", email: "", question: "" });
    } catch (error) {
      console.error("Error submitting question:", error);
      toast({
        title: "Fehler",
        description: "Frage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          Frage zum Fahrzeug
        </CardTitle>
        <CardDescription>
          Haben Sie eine Frage zu diesem {vehicleTitle}? Unser Team wird sich schnellstmöglich bei Ihnen melden.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!user && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="question-name">Name (optional)</Label>
                  <Input
                    id="question-name"
                    placeholder="Ihr Name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-email">E-Mail *</Label>
                  <Input
                    id="question-email"
                    type="email"
                    placeholder="ihre@email.de"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="question-text">Ihre Frage *</Label>
            <Textarea
              id="question-text"
              placeholder="Stellen Sie hier Ihre Frage zum Fahrzeug..."
              value={formData.question}
              onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? "Wird gesendet..." : "Frage senden"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
