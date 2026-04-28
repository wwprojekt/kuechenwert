import {
  Zap,
  Calendar,
  CalendarDays,
  CalendarClock,
  Clock,
  HelpCircle,
  Grip,
  GripHorizontal,
  Hand,
  Layers,
  SquareStack,
  Truck,
  PackageCheck,
  Boxes,
  Wallet,
  BadgePercent,
  Coins,
  TreePine,
  Gem,
  Box,
  FlaskConical,
  Wrench,
  CircleDot,
  Square,
  Sparkles,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/**
 * Icon-Maps fuer die Card-basierten Steps in Funnel B.
 * Analog zu funnel-a-icons.tsx – damit die Karten nicht wie
 * leere Textboxen wirken. Werden an die CardGroup via
 * `icon`-Prop uebergeben.
 */

const iconClass = "h-5 w-5";

export const TIMEFRAME_ICONS_B: Record<string, React.ReactNode> = {
  "0-3": <Zap className={iconClass} />,
  "3-6": <Calendar className={iconClass} />,
  "6-12": <CalendarDays className={iconClass} />,
  "12+": <CalendarClock className={iconClass} />,
  flexibel: <Clock className={iconClass} />,
};

export const HANDLE_TYPE_ICONS: Record<string, React.ReactNode> = {
  "mit-griff": <Grip className={iconClass} />,
  "grifflos-push": <Hand className={iconClass} />,
  "grifflos-servo": <Zap className={iconClass} />,
  "pseudogrifflos-j": <GripHorizontal className={iconClass} />,
  "pseudogrifflos-c": <SquareStack className={iconClass} />,
  mischvariante: <Layers className={iconClass} />,
};

export const WORKTOP_ICONS: Record<string, React.ReactNode> = {
  schichtstoff: <Layers className={iconClass} />,
  massivholz: <TreePine className={iconClass} />,
  granit: <Gem className={iconClass} />,
  marmor: <Sparkles className={iconClass} />,
  quarzkomposit: <Gem className={iconClass} />,
  keramik: <Box className={iconClass} />,
  edelstahl: <Square className={iconClass} />,
  beton: <SquareStack className={iconClass} />,
  glas: <FlaskConical className={iconClass} />,
  mineralwerkstoff: <Box className={iconClass} />,
};

export const SINK_MATERIAL_ICONS: Record<string, React.ReactNode> = {
  "edelstahl-sink": <Square className={iconClass} />,
  "granit-komposit": <Gem className={iconClass} />,
  "keramik-sink": <Box className={iconClass} />,
  tectonite: <CircleDot className={iconClass} />,
  mineralguss: <Box className={iconClass} />,
  kupfer: <Coins className={iconClass} />,
  "sonstige-sink-mat": <HelpCircle className={iconClass} />,
};

export const WASTE_SEP_ICONS: Record<string, React.ReactNode> = {
  yes: <CheckCircle2 className={iconClass} />,
  no: <XCircle className={iconClass} />,
  unknown: <HelpCircle className={iconClass} />,
};

export const DELIVERY_ICONS: Record<string, React.ReactNode> = {
  delivery_assembly: <Wrench className={iconClass} />,
  delivery_only: <Truck className={iconClass} />,
  pickup: <PackageCheck className={iconClass} />,
  unknown: <HelpCircle className={iconClass} />,
};

export const FINANCING_ICONS: Record<string, React.ReactNode> = {
  none: <Wallet className={iconClass} />,
  zero_interest: <BadgePercent className={iconClass} />,
  with_interest: <Coins className={iconClass} />,
};

export const APPLIANCE_CATEGORY_ICON = <Boxes className={iconClass} />;
export const TRASH_ICON = <Trash2 className={iconClass} />;
