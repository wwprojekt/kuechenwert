import { Clock, ImageIcon, KeyRound, MapPin, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { formLabel } from "@/features/funnel-a/catalog";
import { cn } from "@/lib/utils";
import type { DealerProjectRow } from "../dealer-api";

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

export function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "beendet";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `noch ${d} T ${h} Std` : `noch ${h} Std`;
}

export function projectTitle(p: Pick<DealerProjectRow, "summary" | "funnel_type">): string {
  const s = p.summary ?? {};
  if (s.room?.description) return s.room.description;
  const title = p.funnel_type === "b" ? "Angebot unterbieten" : "Küchenprojekt";
  const form = formLabel(s.kitchen_form);
  return form ? `${title} · ${form}` : title;
}

export function projectValue(p: Pick<DealerProjectRow, "estimate_min_eur" | "estimate_max_eur" | "reference_price_eur">): string {
  if (p.estimate_min_eur && p.estimate_max_eur) return `${euro(p.estimate_min_eur)} – ${euro(p.estimate_max_eur)}`;
  if (p.reference_price_eur) return `ca. ${euro(p.reference_price_eur)}`;
  return "Preis offen";
}

const FUNNEL_BADGE: Record<DealerProjectRow["funnel_type"], string> = {
  traumkueche: "KI-Planung",
  a: "Anfrage",
  b: "Angebot unterbieten",
};

export function DealerProjectCard({ project, imageUrl }: { project: DealerProjectRow; imageUrl?: string | null }) {
  const left = timeLeft(project.ends_at);
  const mine = project.my_offer;
  return (
    <Link
      to={`/dashboard/projekte/${project.auction_id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border-2 bg-card transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg",
        project.awarded_to_me ? "border-primary" : "border-border",
      )}
    >
      <div className="relative aspect-[16/10] bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">{FUNNEL_BADGE[project.funnel_type]}</span>
        {left && project.status === "active" && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow">
            <Clock className="h-3 w-3" /> {left}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-1 font-bold text-foreground">{projectTitle(project)}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> PLZ {project.postal_prefix}
            {project.distance_km != null && ` · ${Math.round(project.distance_km)} km`}
          </p>
        </div>
        <p className="text-lg font-extrabold tabular-nums text-foreground">{projectValue(project)}</p>
        <div className="mt-auto flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 font-medium">
            <Users className="h-3 w-3" /> {project.offer_count} {project.offer_count === 1 ? "Angebot" : "Angebote"}
            {project.lowest_offer_eur ? ` · ab ${euro(project.lowest_offer_eur)}` : ""}
          </span>
          {mine && mine.status !== "withdrawn" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">
              Ihr Angebot: {euro(mine.price_eur)}
            </span>
          )}
          {project.contact_unlocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-1 font-semibold text-foreground">
              <KeyRound className="h-3 w-3" /> Kontakt frei
            </span>
          )}
          {project.awarded_to_me && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 font-semibold text-primary-foreground">
              <Trophy className="h-3 w-3" /> Zuschlag
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
