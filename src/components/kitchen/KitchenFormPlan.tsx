import type { ReactElement } from "react";
import type { KitchenFormId } from "@/features/planner/core";
import { cn } from "@/lib/utils";

/**
 * Grundriss je Küchenform in der Draufsicht: Raum, Schrankzeilen, Kochfeld,
 * Spüle und bei Theke/Insel Barhocker. Gleiche Formsprache wie die
 * Grundriss-Skizze im Konfigurator; viewBox 160 × 120 passt in 4:3-Kacheln.
 */

const X0 = 14;
const Y0 = 12;
const X1 = 146;
const Y1 = 108;
const D = 20;
const LEG = 62;

function Run({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={2} className="fill-primary/20 stroke-primary" strokeWidth={1.75} />;
}

function Hob({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="fill-none stroke-primary" strokeWidth={1.25}>
      {[-4.2, 4.2].flatMap((dx) =>
        [-4.2, 4.2].map((dy) => <circle key={`${dx}:${dy}`} cx={cx + dx} cy={cy + dy} r={2.4} />),
      )}
    </g>
  );
}

function Sink({ cx, cy, vertical = false }: { cx: number; cy: number; vertical?: boolean }) {
  const w = vertical ? 9 : 13;
  const h = vertical ? 13 : 9;
  return (
    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={2} className="fill-card stroke-primary" strokeWidth={1.25} />
  );
}

function Stools({ y, xs }: { y: number; xs: number[] }) {
  return (
    <g className="fill-card stroke-primary/60" strokeWidth={1.25}>
      {xs.map((x) => (
        <circle key={x} cx={x} cy={y} r={3.4} />
      ))}
    </g>
  );
}

const TOP = { x: X0, y: Y0, w: X1 - X0, h: D };
const LEFT = { x: X0, y: Y0 + D, w: D, h: LEG };
const RIGHT = { x: X1 - D, y: Y0 + D, w: D, h: LEG };

const PLANS: Record<KitchenFormId, () => ReactElement> = {
  zeile: () => (
    <>
      <Run {...TOP} />
      <Hob cx={X0 + 42} cy={Y0 + D / 2} />
      <Sink cx={X0 + 92} cy={Y0 + D / 2} />
    </>
  ),
  parallel: () => (
    <>
      <Run {...TOP} />
      <Run x={X0} y={Y1 - D} w={104} h={D} />
      <Hob cx={X0 + 48} cy={Y0 + D / 2} />
      <Sink cx={X0 + 52} cy={Y1 - D / 2} />
    </>
  ),
  l: () => (
    <>
      <Run {...TOP} />
      <Run {...LEFT} />
      <Hob cx={X0 + 76} cy={Y0 + D / 2} />
      <Sink cx={X0 + D / 2} cy={Y0 + D + 32} vertical />
    </>
  ),
  u: () => (
    <>
      <Run {...TOP} />
      <Run {...LEFT} />
      <Run {...RIGHT} />
      <Hob cx={(X0 + X1) / 2} cy={Y0 + D / 2} />
      <Sink cx={X0 + D / 2} cy={Y0 + D + 30} vertical />
    </>
  ),
  g: () => (
    <>
      <Run {...TOP} />
      <Run {...LEFT} />
      <Run {...RIGHT} />
      <Run x={X1 - D - 48} y={Y0 + D + LEG - D} w={48} h={D} />
      <Hob cx={(X0 + X1) / 2} cy={Y0 + D / 2} />
      <Sink cx={X0 + D / 2} cy={Y0 + D + 30} vertical />
      <Stools y={Y0 + D + LEG + 6} xs={[X1 - D - 38, X1 - D - 24, X1 - D - 10]} />
    </>
  ),
  insel: () => (
    <>
      <Run {...TOP} />
      <Run x={44} y={54} w={72} h={24} />
      <Sink cx={X0 + 44} cy={Y0 + D / 2} />
      <Hob cx={80} cy={66} />
      <Stools y={88} xs={[64, 80, 96]} />
    </>
  ),
};

export function hasKitchenFormPlan(id: string): id is KitchenFormId {
  return Object.prototype.hasOwnProperty.call(PLANS, id);
}

export function KitchenFormPlan({ form, className }: { form: string; className?: string }) {
  if (!hasKitchenFormPlan(form)) return null;
  const Plan = PLANS[form];
  return (
    <svg viewBox="0 0 160 120" className={cn("h-full w-full", className)} aria-hidden="true" focusable="false">
      <rect
        x={X0 - 4}
        y={Y0 - 4}
        width={X1 - X0 + 8}
        height={Y1 - Y0 + 8}
        rx={5}
        className="fill-card stroke-foreground/25"
        strokeWidth={2.5}
      />
      <Plan />
    </svg>
  );
}
