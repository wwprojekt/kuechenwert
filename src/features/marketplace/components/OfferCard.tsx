import { BadgeCheck, CalendarClock, Check, Globe, MapPin, Star, Truck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OFFER_INCLUDE_LABELS, type OfferIncludes, type ProjectOffer } from "../project-api";

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

export function OfferCard({
  offer,
  rank,
  referenceEur,
  canAccept,
  onAccept,
}: {
  offer: ProjectOffer;
  rank: number;
  referenceEur: number | null;
  canAccept: boolean;
  onAccept: (offer: ProjectOffer) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const delta = referenceEur ? (offer.price_eur - referenceEur) / referenceEur : null;
  const includes = Object.entries(offer.includes ?? {}).filter(([, v]) => v) as Array<[keyof OfferIncludes, boolean]>;
  const accepted = offer.status === "accepted";
  const declined = offer.status === "declined";

  return (
    <article
      className={cn(
        "relative rounded-2xl border-2 bg-card p-5 transition sm:p-6",
        accepted ? "border-primary shadow-lg" : declined ? "border-border opacity-60" : rank === 1 ? "border-primary/40 shadow-md" : "border-border",
      )}
    >
      {rank === 1 && !accepted && !declined && (
        <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">Günstigstes Angebot</span>
      )}
      {accepted && (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">
          <Check className="h-3.5 w-3.5" /> Ihre Wahl
        </span>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-lg font-bold text-foreground">
            {offer.dealer.company_name}
            {offer.dealer.verified && <BadgeCheck className="h-5 w-5 text-primary" aria-label="Geprüftes Studio" />}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {offer.dealer.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {offer.dealer.city}
                {offer.dealer.distance_km != null && ` · ${Math.round(offer.dealer.distance_km)} km`}
              </span>
            )}
            {offer.dealer.rating != null && offer.dealer.reviews > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {Number(offer.dealer.rating).toLocaleString("de-DE", { maximumFractionDigits: 1 })} ({offer.dealer.reviews})
              </span>
            )}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-extrabold tabular-nums text-foreground">{euro(offer.price_eur)}</p>
          {delta != null && (
            <p className={cn("text-sm font-semibold", delta <= 0 ? "text-primary" : "text-amber-600 dark:text-amber-400")}>
              {delta <= 0 ? `${Math.round(Math.abs(delta) * 100)} % unter Schätzung` : `${Math.round(delta * 100)} % über Schätzung`}
            </p>
          )}
          {offer.revision > 1 && <p className="text-xs text-muted-foreground">Preis {offer.revision - 1}× gesenkt</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {includes.map(([key]) => (
          <span key={key} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Check className="h-3 w-3" /> {OFFER_INCLUDE_LABELS[key]}
          </span>
        ))}
        {offer.delivery_weeks && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            <Truck className="h-3 w-3" /> Lieferung in ca. {offer.delivery_weeks} Wochen
          </span>
        )}
        {offer.valid_until && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            <CalendarClock className="h-3 w-3" /> gültig bis {new Date(offer.valid_until).toLocaleDateString("de-DE")}
          </span>
        )}
      </div>

      {(offer.message || offer.dealer.intro) && (
        <div className="mt-4 text-sm leading-relaxed text-muted-foreground">
          <p className={cn(!expanded && "line-clamp-3")}>{offer.message || offer.dealer.intro}</p>
          {(offer.message ?? offer.dealer.intro ?? "").length > 180 && (
            <button type="button" className="mt-1 font-semibold text-primary hover:underline" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Weniger anzeigen" : "Mehr lesen"}
            </button>
          )}
        </div>
      )}

      {accepted && (
        <div className="mt-5 grid gap-2 rounded-xl bg-primary/5 p-4 text-sm sm:grid-cols-2">
          {offer.dealer.phone && (
            <a href={`tel:${offer.dealer.phone.replace(/\s/g, "")}`} className="font-semibold text-primary hover:underline">
              {offer.dealer.phone}
            </a>
          )}
          {offer.dealer.email && (
            <a href={`mailto:${offer.dealer.email}`} className="font-semibold text-primary hover:underline">
              {offer.dealer.email}
            </a>
          )}
          {(offer.dealer.street || offer.dealer.postal_code) && (
            <span className="text-muted-foreground">
              {[offer.dealer.street, [offer.dealer.postal_code, offer.dealer.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
            </span>
          )}
          {offer.dealer.website && (
            <a href={offer.dealer.website.startsWith("http") ? offer.dealer.website : `https://${offer.dealer.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          )}
        </div>
      )}

      {canAccept && offer.status === "active" && (
        <div className="mt-5 flex justify-end">
          <Button onClick={() => onAccept(offer)} size="lg" className="w-full font-semibold sm:w-auto">
            Dieses Angebot wählen
          </Button>
        </div>
      )}
    </article>
  );
}
