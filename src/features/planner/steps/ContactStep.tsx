import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { KitchenEstimate } from "../core";
import { PriceRange } from "../components/PriceSummary";

const schema = z.object({
  first_name: z.string().trim().min(1, "Bitte Vornamen angeben").max(80),
  last_name: z.string().trim().min(1, "Bitte Nachnamen angeben").max(80),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben"),
  phone: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 6, "Bitte eine gültige Telefonnummer angeben"),
  postal_code: z.string().trim().regex(/^\d{5}$/, "Bitte eine 5-stellige PLZ angeben"),
  city: z.string().trim().max(80).optional(),
  timeframe_months: z.string(),
  housing_type: z.enum(["own", "rent", "unknown"]),
  share_with_studios: z.literal(true, { errorMap: () => ({ message: "Ohne diese Einwilligung können wir keine Angebote einholen." }) }),
  contact_by_phone: z.boolean(),
  marketing: z.boolean(),
  website: z.string().max(0).optional(),
});

export type ContactValues = z.infer<typeof schema>;

const TIMEFRAMES = [
  { value: "1", label: "So schnell wie möglich" },
  { value: "3", label: "In 1–3 Monaten" },
  { value: "6", label: "In 3–6 Monaten" },
  { value: "12", label: "In 6–12 Monaten" },
  { value: "24", label: "Später / erst Ideen sammeln" },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

export function ContactStep({
  estimate,
  coverUrl,
  defaultPostalCode,
  submitting,
  error,
  onSubmit,
  turnstileRef,
}: {
  estimate: KitchenEstimate;
  coverUrl: string | null;
  defaultPostalCode: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: ContactValues) => void;
  turnstileRef: (node: HTMLDivElement | null) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      postal_code: defaultPostalCode,
      city: "",
      timeframe_months: "3",
      housing_type: "own",
      share_with_studios: false as unknown as true,
      contact_by_phone: true,
      marketing: false,
      website: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div className="space-y-6 rounded-2xl border bg-card p-5 sm:p-7">
        <div>
          <h3 className="text-lg font-bold text-foreground">Wohin dürfen die Studios ihre Angebote schicken?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Studios sehen Ihre Planung zunächst anonym. Ihre Kontaktdaten erhält nur, wen Sie auswählen – und höchstens drei Studios, die Sie
            persönlich beraten möchten.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">Vorname</Label>
            <Input id="first_name" autoComplete="given-name" className="h-11" {...register("first_name")} aria-invalid={!!errors.first_name} />
            <FieldError message={errors.first_name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name">Nachname</Label>
            <Input id="last_name" autoComplete="family-name" className="h-11" {...register("last_name")} aria-invalid={!!errors.last_name} />
            <FieldError message={errors.last_name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" autoComplete="email" className="h-11" {...register("email")} aria-invalid={!!errors.email} />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" type="tel" autoComplete="tel" className="h-11" {...register("phone")} aria-invalid={!!errors.phone} />
            <FieldError message={errors.phone?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postal_code">PLZ des Einbauorts</Label>
            <Input id="postal_code" inputMode="numeric" maxLength={5} autoComplete="postal-code" className="h-11" {...register("postal_code")} aria-invalid={!!errors.postal_code} />
            <FieldError message={errors.postal_code?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Ort (optional)</Label>
            <Input id="city" autoComplete="address-level2" className="h-11" {...register("city")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="timeframe">Wann soll die Küche kommen?</Label>
            <select
              id="timeframe"
              {...register("timeframe_months")}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {TIMEFRAMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Wohnsituation</Label>
            <Controller
              control={control}
              name="housing_type"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="flex h-11 items-center gap-4">
                  {[
                    { v: "own", l: "Eigentum" },
                    { v: "rent", l: "Miete" },
                    { v: "unknown", l: "k. A." },
                  ].map((o) => (
                    <label key={o.v} className="flex cursor-pointer items-center gap-2 text-sm">
                      <RadioGroupItem value={o.v} /> {o.l}
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-muted/50 p-4">
          <Controller
            control={control}
            name="share_with_studios"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                <span>
                  Ich willige ein, dass KüchenWert meine Planung ohne Kontaktdaten geprüften Küchenstudios zur Angebotserstellung zeigt und meine
                  Kontaktdaten an das von mir gewählte Studio sowie an bis zu drei Studios zur persönlichen Beratung weitergibt. Widerruf jederzeit
                  möglich. <span className="font-semibold">(erforderlich)</span>
                </span>
              </label>
            )}
          />
          <FieldError message={errors.share_with_studios?.message} />
          <Controller
            control={control}
            name="contact_by_phone"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                <span>Studios und KüchenWert dürfen mich zu meinem Projekt auch telefonisch kontaktieren.</span>
              </label>
            )}
          />
          <Controller
            control={control}
            name="marketing"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                <span>Ich möchte Planungstipps und Aktionen von KüchenWert per E-Mail erhalten (jederzeit abbestellbar).</span>
              </label>
            )}
          />
        </div>

        <div className="hidden" aria-hidden>
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" {...register("website")} />
          </label>
        </div>
        <div ref={turnstileRef} />

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full text-base font-semibold">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Projekt wird angelegt …
            </>
          ) : (
            "Kostenlos Angebote erhalten"
          )}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Mit dem Absenden akzeptieren Sie die{" "}
          <Link to="/datenschutz" className="underline underline-offset-2">
            Datenschutzerklärung
          </Link>
          . Für Sie kostenlos, ohne Kaufverpflichtung.
        </p>
      </div>

      <aside className="space-y-4">
        <div className="overflow-hidden rounded-2xl border bg-card">
          {coverUrl ? (
            <img src={coverUrl} alt="Ihre geplante Küche" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="grid aspect-[4/3] place-items-center bg-muted text-sm text-muted-foreground">Ihre Planung</div>
          )}
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">KI-Preisschätzung</p>
            <p className="mt-1 text-xl font-extrabold text-foreground">
              <PriceRange estimate={estimate} />
            </p>
          </div>
        </div>
        <ol className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
          {[
            "Ihr Projekt geht anonym an geprüfte Studios in Ihrer Region.",
            "Studios geben innerhalb von 7 Tagen verbindliche Angebote ab – und unterbieten sich gegenseitig.",
            "Sie vergleichen auf Ihrer Projektseite und wählen Ihr Studio. Erst dann erhält es Ihre Kontaktdaten.",
          ].map((text, i) => (
            <li key={text} className="flex gap-3">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
              <span className="text-muted-foreground">{text}</span>
            </li>
          ))}
        </ol>
        <p className={cn("flex items-center gap-2 text-xs text-muted-foreground")}>
          <ShieldCheck className="h-4 w-4 text-primary" /> DSGVO-konform · Server in der EU · SSL-verschlüsselt
        </p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Nur geprüfte Küchenstudios mit Gewerbenachweis
        </p>
      </aside>
    </form>
  );
}
