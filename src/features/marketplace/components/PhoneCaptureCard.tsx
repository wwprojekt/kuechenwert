import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Phone } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PHONE_LATER_TERMS } from "../../../../supabase/functions/_shared/lead-terms.ts";
import { errorMessage } from "../api-client";
import { addProjectPhone } from "../project-api";

const digitCount = (value: string) => value.replace(/\D/g, "").length;

const phoneSchema = z.object({
  // 6–16 Ziffern wie normalizePhone in kw-project – andere Nummern lehnt die Function ab.
  phone: z
    .string()
    .trim()
    .refine((v) => /^\+?[\d\s()/-]+$/.test(v) && digitCount(v) >= 6 && digitCount(v) <= 16, "Bitte eine gültige Telefonnummer angeben."),
});
type PhoneValues = z.infer<typeof phoneSchema>;

/** Telefonnummer nachtragen (ältere Anfragen ohne Nummer); der Hinweis ist PHONE_LATER_TERMS. */
export function PhoneCaptureCard({ token, onSaved, className }: { token: string; onSaved: () => void; className?: string }) {
  const qc = useQueryClient();
  const doneRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<PhoneValues>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: "" } });
  const { errors } = form.formState;
  const save = useMutation({
    mutationFn: (v: PhoneValues) => addProjectPhone(token, v.phone),
    onSuccess: () => {
      onSaved();
      void qc.invalidateQueries({ queryKey: ["kw-project", token] });
    },
  });

  useEffect(() => {
    if (save.isSuccess) doneRef.current?.focus();
  }, [save.isSuccess]);

  if (save.isSuccess) {
    return (
      <div className={cn("flex gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5", className)}>
        <CheckCircle2 className="h-6 w-6 flex-none text-primary" />
        <div>
          <p ref={doneRef} tabIndex={-1} className="font-bold outline-none">
            {save.data?.already ? "Für Ihr Projekt ist bereits eine Telefonnummer hinterlegt." : "Danke – Ihre Telefonnummer ist gespeichert."}
          </p>
          {!save.data?.already && (
            <p className="mt-1 text-sm text-muted-foreground">
              Studios, die Ihren Kontakt freischalten, können Rückfragen jetzt kurz telefonisch mit Ihnen klären. Anrufe können Sie auf dieser
              Seite jederzeit ausschalten.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="flex gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-primary/10 text-primary">
          <Phone className="h-5 w-5" />
        </span>
        <div className="max-w-2xl">
          <h2 className="font-bold leading-snug">Telefonnummer ergänzen – schneller zum passenden Angebot</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Studios klären Rückfragen zu Maßen und Wünschen oft in einem kurzen Telefonat. {PHONE_LATER_TERMS.notice}
          </p>
        </div>
      </div>

      <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="mt-4 max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="project-phone">Telefonnummer</Label>
          <Input
            id="project-phone"
            type="tel"
            autoComplete="tel"
            placeholder="z. B. 0171 2345678"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "project-phone-error" : undefined}
            {...form.register("phone")}
          />
          {errors.phone && (
            <p id="project-phone-error" className="text-xs font-medium text-destructive">
              {errors.phone.message}
            </p>
          )}
        </div>

        {save.isError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errorMessage(save.error)}
          </p>
        )}
        <Button type="submit" className="w-full sm:w-auto" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Nummer speichern
        </Button>
      </form>
    </div>
  );
}
