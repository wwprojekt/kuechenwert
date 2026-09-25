import { ClipboardList, HandCoins, Scale, Store, type LucideIcon } from "lucide-react";

const STEPS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: ClipboardList,
    title: "Wünsche angeben",
    text: "Form, Stil, Geräte, Budget und Zeitraum – in ca. 2 Minuten beantwortet.",
  },
  {
    icon: Store,
    title: "Studios geben Angebote ab",
    text: "Geprüfte Küchenstudios aus Ihrer Region sehen Ihre Anfrage ohne Namen und Kontaktdaten und schicken Ihnen ihre Angebote.",
  },
  {
    icon: Scale,
    title: "Vergleichen & wählen",
    text: "Auf Ihrer persönlichen Projektseite vergleichen Sie alle Angebote in Ruhe und wählen Ihr Studio – oder keines.",
  },
];

export function HowItWorksSteps() {
  return (
    <section aria-labelledby="formular-ablauf" className="container max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <h2 id="formular-ablauf" className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        So funktioniert’s
      </h2>
      <ol className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
                {i + 1}
              </span>
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
        <HandCoins className="mt-0.5 h-6 w-6 flex-none text-primary" aria-hidden="true" />
        <div>
          <h3 className="font-bold text-foreground">So finanzieren wir uns</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Für Sie ist KüchenWert kostenlos. Küchenstudios zahlen für freigeschaltete Kontakte und eine Provision, wenn Sie ihr Angebot
            annehmen. Angebote sortieren wir nach Preis – nicht nach Zahlungen.
          </p>
        </div>
      </div>
    </section>
  );
}
