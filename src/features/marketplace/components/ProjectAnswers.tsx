import { describeLeadSummary, type DetailGroup } from "@/features/funnel-a/catalog";
import { cn } from "@/lib/utils";

/** Gruppierte Angaben als Karte; ohne Gruppen rendert die Komponente nichts. */
export function DetailGroupsCard({ groups, title, wide = false }: { groups: DetailGroup[]; title: string; wide?: boolean }) {
  if (groups.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.title}</h3>
            <dl className={cn("mt-2 grid gap-y-2 text-sm", wide && "gap-x-6 sm:grid-cols-2")}>
              {group.rows.map((row) => (
                <div key={row.label} className="flex gap-3">
                  <dt className="w-28 flex-none text-muted-foreground">{row.label}</dt>
                  <dd className="min-w-0 font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Angaben eines Projekts aus dem Funnel (A, B oder der Rahmen von C). */
export function ProjectAnswers({ summary, title, wide = false }: { summary: unknown; title: string; wide?: boolean }) {
  return <DetailGroupsCard groups={describeLeadSummary(summary)} title={title} wide={wide} />;
}
