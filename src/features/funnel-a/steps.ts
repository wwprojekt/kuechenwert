import {
  COLOR_OPTIONS,
  COOKSTYLE_OPTIONS,
  COOKTOP_OPTIONS,
  COOLING_OPTIONS,
  DECISION_OPTIONS,
  EXTRA_APPLIANCE_OPTIONS,
  FORM_OPTIONS,
  HOUSING_OPTIONS,
  OCCASION_OPTIONS,
  OVEN_OPTIONS,
  ROOM_TYPE_OPTIONS,
  SIZE_OPTIONS,
  STYLE_OPTIONS,
  TIMEFRAME_OPTIONS,
  UNSURE,
  WORKTOP_OPTIONS,
  missingRequired,
  type ChoiceOption,
  type FunnelAAnswers,
} from "./catalog";

export const FUNNEL_A_BASE_PATH = "/funnel/a";

/** URL-Slugs in Funnel-Reihenfolge; /formular verlinkt auf kuechenform und raum. */
export const FUNNEL_A_SLUGS = [
  "kuechenform",
  "raum",
  "groesse",
  "stil",
  "farbe",
  "arbeitsplatte",
  "kochfeld",
  "backofen",
  "kuehlen",
  "geraete",
  "kochstil",
  "anlass",
  "wohnsituation",
  "entscheidung",
  "zeitrahmen",
  "budget",
  "plz",
  "kontakt",
] as const;

export type FunnelAStepSlug = (typeof FUNNEL_A_SLUGS)[number];

export type ExtraApplianceId = FunnelAAnswers["extra_appliances"][number];

/** Antwortfelder, die per Einzelauswahl (Kachel) beantwortet werden. */
export type ChoiceField = Exclude<keyof FunnelAAnswers, "extra_appliances" | "budget_eur" | "postal_code">;

/** Katalog-Option; Farbwelten bringen Farbmuster mit. */
export type FunnelAOption = ChoiceOption & { swatches?: readonly string[] };

interface StepBase {
  slug: FunnelAStepSlug;
  eyebrow: string;
  question: string;
  hint?: string;
  /** Pflichtschritt: „Weiter“ erst nach einer Antwort. */
  required: boolean;
}

export type FunnelAStep =
  | (StepBase & { kind: "choice"; field: ChoiceField; options: readonly FunnelAOption[] })
  | (StepBase & { kind: "multi"; field: "extra_appliances"; options: readonly ChoiceOption<ExtraApplianceId>[] })
  | (StepBase & { kind: "budget"; field: "budget_eur" })
  | (StepBase & { kind: "plz"; field: "postal_code" })
  | (StepBase & { kind: "contact" });

export type FunnelAChoiceStep = Extract<FunnelAStep, { kind: "choice" }>;

export const FUNNEL_A_STEPS: readonly FunnelAStep[] = [
  {
    slug: "kuechenform",
    kind: "choice",
    field: "kitchen_form",
    options: FORM_OPTIONS,
    required: true,
    eyebrow: "Küchenform",
    question: "Welche Küchenform wünschen Sie sich?",
    hint: "Wählen Sie die Form, die Ihrem Raum am nächsten kommt.",
  },
  {
    slug: "raum",
    kind: "choice",
    field: "room_type",
    options: ROOM_TYPE_OPTIONS,
    required: false,
    eyebrow: "Raum",
    question: "Ist die Küche offen oder ein eigener Raum?",
  },
  {
    slug: "groesse",
    kind: "choice",
    field: "kitchen_size",
    options: SIZE_OPTIONS,
    required: false,
    eyebrow: "Größe",
    question: "Wie groß ist der Küchenraum ungefähr?",
    hint: "Eine grobe Schätzung reicht – genau ausgemessen wird später vor Ort.",
  },
  {
    slug: "stil",
    kind: "choice",
    field: "kitchen_style",
    options: STYLE_OPTIONS,
    required: false,
    eyebrow: "Stil",
    question: "Welcher Küchenstil gefällt Ihnen?",
  },
  {
    slug: "farbe",
    kind: "choice",
    field: "color_preference",
    options: COLOR_OPTIONS,
    required: false,
    eyebrow: "Farbwelt",
    question: "Welche Farbwelt passt zu Ihnen?",
  },
  {
    slug: "arbeitsplatte",
    kind: "choice",
    field: "worktop_category",
    options: WORKTOP_OPTIONS,
    required: false,
    eyebrow: "Arbeitsplatte",
    question: "Welches Material soll die Arbeitsplatte haben?",
  },
  {
    slug: "kochfeld",
    kind: "choice",
    field: "cooktop_type",
    options: COOKTOP_OPTIONS,
    required: false,
    eyebrow: "Kochfeld",
    question: "Worauf möchten Sie kochen?",
  },
  {
    slug: "backofen",
    kind: "choice",
    field: "oven_placement",
    options: OVEN_OPTIONS,
    required: false,
    eyebrow: "Backofen",
    question: "Wo soll der Backofen eingebaut werden?",
  },
  {
    slug: "kuehlen",
    kind: "choice",
    field: "cooling",
    options: COOLING_OPTIONS,
    required: false,
    eyebrow: "Kühlschrank",
    question: "Welcher Kühlschrank soll es sein?",
  },
  {
    slug: "geraete",
    kind: "multi",
    field: "extra_appliances",
    options: EXTRA_APPLIANCE_OPTIONS,
    required: false,
    eyebrow: "Weitere Geräte · optional",
    question: "Welche Geräte wünschen Sie sich noch?",
    hint: "Mehrfachauswahl möglich.",
  },
  {
    slug: "kochstil",
    kind: "choice",
    field: "cooking_style",
    options: COOKSTYLE_OPTIONS,
    required: false,
    eyebrow: "Kochstil",
    question: "Wie wird bei Ihnen gekocht?",
  },
  {
    slug: "anlass",
    kind: "choice",
    field: "purchase_reason",
    options: OCCASION_OPTIONS,
    required: false,
    eyebrow: "Anlass",
    question: "Was ist der Anlass für die neue Küche?",
  },
  {
    slug: "wohnsituation",
    kind: "choice",
    field: "housing",
    options: HOUSING_OPTIONS,
    required: false,
    eyebrow: "Wohnsituation",
    question: "Wie wohnen Sie?",
  },
  {
    slug: "entscheidung",
    kind: "choice",
    field: "decision_maker",
    options: DECISION_OPTIONS,
    required: false,
    eyebrow: "Entscheidung",
    question: "Wer entscheidet über die neue Küche?",
  },
  {
    slug: "zeitrahmen",
    kind: "choice",
    field: "timeframe",
    options: TIMEFRAME_OPTIONS,
    required: true,
    eyebrow: "Zeitrahmen",
    question: "Wann soll die neue Küche stehen?",
    hint: "So können die Studios Planung und Lieferzeit darauf abstimmen.",
  },
  {
    slug: "budget",
    kind: "budget",
    field: "budget_eur",
    required: false,
    eyebrow: "Budget",
    question: "Welches Budget haben Sie eingeplant?",
    hint: "Ihr Budget hilft den Studios, ein passendes Angebot zu erstellen.",
  },
  {
    slug: "plz",
    kind: "plz",
    field: "postal_code",
    required: true,
    eyebrow: "Einbauort",
    question: "Gleich geschafft – wo soll die Küche hin?",
    hint: "Ihre Postleitzahl nutzen wir nur, um geprüfte Küchenstudios in Ihrer Nähe zu finden.",
  },
  {
    slug: "kontakt",
    kind: "contact",
    required: true,
    eyebrow: "Kontakt",
    question: "Wohin dürfen wir Ihre Angebote schicken?",
    hint: "Kostenlos und unverbindlich – Sie entscheiden, ob Sie ein Angebot annehmen.",
  },
];

export const FUNNEL_A_FIRST_SLUG: FunnelAStepSlug = FUNNEL_A_SLUGS[0];

export function isFunnelAStepSlug(value: unknown): value is FunnelAStepSlug {
  return typeof value === "string" && (FUNNEL_A_SLUGS as readonly string[]).includes(value);
}

export function stepPath(slug: FunnelAStepSlug): string {
  return `${FUNNEL_A_BASE_PATH}/${slug}`;
}

export function stepIndex(slug: FunnelAStepSlug): number {
  return FUNNEL_A_SLUGS.indexOf(slug);
}

export function findStep(slug: FunnelAStepSlug): FunnelAStep {
  const step = FUNNEL_A_STEPS.find((s) => s.slug === slug);
  if (!step) throw new Error(`Unbekannter Funnel-A-Schritt: ${slug}`);
  return step;
}

export function isStepAnswered(step: FunnelAStep, answers: FunnelAAnswers): boolean {
  switch (step.kind) {
    case "choice":
      return answers[step.field] !== "";
    case "multi":
      return answers.extra_appliances.length > 0;
    case "budget":
      return true;
    case "plz":
      return /^\d{5}$/.test(answers.postal_code);
    case "contact":
      return false;
  }
}

export function canLeaveStep(step: FunnelAStep, answers: FunnelAAnswers): boolean {
  return !step.required || isStepAnswered(step, answers);
}

const IMAGE_DIRS: Partial<Record<ChoiceField, string>> = {
  kitchen_style: "/images/planner/styles",
};

/** Foto zur Option (Stil); „unsicher“ hat kein Bild. Küchenformen sind Grundrisse (KitchenFormPlan). */
export function optionImage(field: ChoiceField, id: string): string | undefined {
  const dir = IMAGE_DIRS[field];
  return dir && id !== UNSURE ? `${dir}/${id}.webp` : undefined;
}

export function stepImages(step: FunnelAStep): string[] {
  if (step.kind !== "choice") return [];
  return step.options.map((o) => optionImage(step.field, o.id)).filter((src): src is string => !!src);
}

/** Erster Schritt mit fehlender Pflichtangabe, sonst null. */
export function firstMissingStep(answers: FunnelAAnswers): FunnelAStepSlug | null {
  const missing = missingRequired(answers)[0];
  if (!missing) return null;
  return FUNNEL_A_STEPS.find((s) => "field" in s && s.field === missing)?.slug ?? null;
}
