import { MoveHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export function BeforeAfterSlider({
  before,
  after,
  beforeLabel = "Vorher",
  afterLabel = "Nachher",
  className,
  initial = 50,
  priority = false,
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  initial?: number;
  /** Above-the-fold (LCP): Bilder sofort und mit hoher Priorität laden. */
  priority?: boolean;
}) {
  const [pos, setPos] = useState(initial);
  const id = useId();
  const loading = priority ? "eager" : "lazy";
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-muted select-none", className)}>
      <img
        src={after}
        alt={afterLabel}
        className="block h-full w-full object-cover"
        draggable={false}
        loading={loading}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
      <img
        src={before}
        alt={beforeLabel}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
        loading={loading}
        decoding="async"
      />
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
        <div className="absolute top-1/2 -ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full bg-white text-foreground shadow-lg">
          <MoveHorizontal className="h-5 w-5" />
        </div>
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
        {afterLabel}
      </span>
      <label htmlFor={id} className="sr-only">
        Vorher-Nachher-Vergleich verschieben
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
