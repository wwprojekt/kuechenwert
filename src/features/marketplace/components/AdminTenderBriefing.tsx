import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OFFER_INCLUDES, OFFER_INCLUDES_UNKNOWN } from "@/config/funnel-b-stammdaten";
import { KITCHEN_FORMS } from "@/features/planner/core";
import { errorMessage } from "../api-client";
import { fetchLeadDetails, saveExpertBriefing } from "../admin-api";
import { fillBriefingDraft, toBriefingDraft, type BriefingDraft } from "../briefing-draft";
import { DETAILS_NOTES_MAX, RUN_LENGTH_RANGE, describeLeadDetails, type ExpertBriefing } from "../lead-details";
import { AdminPlanReading } from "./AdminPlanReading";

const INCLUDE_OPTIONS = [...OFFER_INCLUDES, { slug: OFFER_INCLUDES_UNKNOWN, name: "Nicht bekannt" }];

interface AdminTenderBriefingProps {
  leadId: string;
  funnelType: string;
  kitchenForm?: string | null;
  /** Funnel B: genannter Preis, zum Abgleich mit einem hochgeladenen Angebot. */
  statedPriceEur?: number | null;
}

/**
 * Ergebnis des Experten-Checks für Studios: vor dem Veröffentlichen
 * festhalten, was im Gespräch geklärt wurde. Bei Funnel B schlägt die
 * KI-Auslesung der hochgeladenen Planung Werte vor. Keine Namen oder
 * Kontaktdaten eintragen; Freitext wird zusätzlich bereinigt.
 */
export function AdminTenderBriefing({ leadId, funnelType, kitchenForm, statedPriceEur }: AdminTenderBriefingProps) {
  const qc = useQueryClient();
  const queryKey = ["admin-lead-details", leadId];
  const details = useQuery({ queryKey, queryFn: () => fetchLeadDetails(leadId) });
  const [draft, setDraft] = useState<BriefingDraft>(() => toBriefingDraft(null));
  const saved = details.data?.expert;

  useEffect(() => {
    setDraft(toBriefingDraft(saved));
  }, [saved]);

  const applySuggestion = (suggestion: ExpertBriefing) => {
    const { draft: next, filled } = fillBriefingDraft(draft, suggestion);
    setDraft(next);
    if (filled.length > 0) toast.success("Vorschlag übernommen – bitte prüfen und dann speichern.");
    else toast.info("Alle passenden Felder sind schon ausgefüllt; überschrieben wurde nichts.");
  };

  const save = useMutation({
    mutationFn: () =>
      saveExpertBriefing(leadId, {
        kitchen_form: (draft.kitchen_form || undefined) as ExpertBriefing["kitchen_form"],
        manufacturer: draft.manufacturer,
        run_length_cm: draft.run_length_cm ? Number(draft.run_length_cm) : undefined,
        offer_includes: draft.offer_includes,
        offer_valid_until: draft.offer_valid_until || undefined,
        notes: draft.notes,
      }),
    onSuccess: () => {
      toast.success("Briefing gespeichert – Studios sehen es im Projekt.");
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const set = (patch: Partial<BriefingDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const toggleInclude = (slug: string, checked: boolean) =>
    set({
      offer_includes:
        slug === OFFER_INCLUDES_UNKNOWN
          ? checked
            ? [OFFER_INCLUDES_UNKNOWN]
            : []
          : checked
            ? [...draft.offer_includes.filter((s) => s !== OFFER_INCLUDES_UNKNOWN), slug]
            : draft.offer_includes.filter((s) => s !== slug),
    });
  const customerGroups = describeLeadDetails(
    { customer: details.data?.customer, customer_updated_at: details.data?.customer_updated_at },
    kitchenForm,
  );
  const runLengthInvalid =
    draft.run_length_cm !== "" && (Number(draft.run_length_cm) < RUN_LENGTH_RANGE.min || Number(draft.run_length_cm) > RUN_LENGTH_RANGE.max);

  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Experten-Check: Briefing für Studios</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Was im Gespräch geklärt wurde, sehen Studios im Projekt – ohne Namen und Kontaktdaten. Bitte keine personenbezogenen Angaben eintragen.
        {funnelType === "b" && " Bei Funnel B vor dem Veröffentlichen ausfüllen, gerade wenn keine Unterlagen vorliegen."}
      </p>

      {details.isLoading ? (
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted-foreground" />
      ) : details.isError ? (
        <p className="mt-3 text-sm text-destructive">{errorMessage(details.error)}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {funnelType === "b" && <AdminPlanReading leadId={leadId} statedPriceEur={statedPriceEur} onApply={applySuggestion} />}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="briefing-form">Küchenform</Label>
              <select
                id="briefing-form"
                value={draft.kitchen_form}
                onChange={(e) => set({ kitchen_form: e.target.value })}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">– keine Angabe –</option>
                {KITCHEN_FORMS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="briefing-manufacturer">Hersteller & Programm</Label>
              <Input id="briefing-manufacturer" value={draft.manufacturer} maxLength={120} onChange={(e) => set({ manufacturer: e.target.value })} placeholder="z. B. Nobilia Touch 334" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="briefing-run">Laufmeter (cm)</Label>
              <Input
                id="briefing-run"
                inputMode="numeric"
                value={draft.run_length_cm}
                onChange={(e) => set({ run_length_cm: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                aria-invalid={runLengthInvalid || undefined}
                placeholder="z. B. 620"
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Im Preis enthalten</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {INCLUDE_OPTIONS.map((o) => (
                <label key={o.slug} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={draft.offer_includes.includes(o.slug)} onCheckedChange={(v) => toggleInclude(o.slug, v === true)} />
                  {o.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <div className="space-y-1">
              <Label htmlFor="briefing-valid">Angebot gültig bis</Label>
              <Input id="briefing-valid" type="date" value={draft.offer_valid_until} onChange={(e) => set({ offer_valid_until: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="briefing-notes">Hinweis für die Studios</Label>
              <Textarea
                id="briefing-notes"
                rows={3}
                value={draft.notes}
                maxLength={DETAILS_NOTES_MAX}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="z. B. Angebot ohne Aufmaß, Arbeitsplatte 12 mm Keramik, Geräte Siemens iQ500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || runLengthInvalid}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Briefing speichern
            </Button>
            {details.data?.expert_updated_at && (
              <span className="text-xs text-muted-foreground">Zuletzt gespeichert am {new Date(details.data.expert_updated_at).toLocaleString("de-DE")}</span>
            )}
          </div>

          {customerGroups.map((group) => (
            <div key={group.title} className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{group.title}</p>
              <dl className="mt-2 space-y-1">
                {group.rows.map((row) => (
                  <div key={row.label} className="flex gap-3">
                    <dt className="w-32 flex-none text-muted-foreground">{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
