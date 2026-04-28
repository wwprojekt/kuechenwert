import {
  Sparkles,
  Wrench,
  Truck,
  RefreshCw,
  HelpCircle,
  Building2,
  Building,
  Home,
  Key,
  Minimize2,
  Square,
  Maximize2,
  Expand,
  Zap,
  Calendar,
  CalendarDays,
  CalendarClock,
  Clock,
  CircleDashed,
  Ruler,
  Sun,
  Moon,
  TreePine,
  Palette,
  Contrast,
  Flame,
  Grid3x3,
  ArrowDown,
  ArrowUp,
  Copy,
  User,
  Users,
  Baby,
  PartyPopper,
  Coffee,
} from "lucide-react";

/**
 * Lucide-Icon-Maps fuer die Text-Card-Steps in Funnel A.
 * Werden im Client-Code an CardStep.options.icon uebergeben.
 *
 * Ziel: Parity zu kuechenportal.de, wo jede Option ein kleines
 * Line-Icon bekommt, damit die Karten nicht wie leere Textboxen wirken.
 */

const iconClass = "h-5 w-5";

export const OCCASION_ICONS: Record<string, React.ReactNode> = {
  neukauf: <Sparkles className={iconClass} />,
  renovierung: <Wrench className={iconClass} />,
  umzug: <Truck className={iconClass} />,
  modernisierung: <RefreshCw className={iconClass} />,
  unsicher: <HelpCircle className={iconClass} />,
};

export const HOUSING_ICONS: Record<string, React.ReactNode> = {
  rent_apartment: <Building2 className={iconClass} />,
  rent_house: <Home className={iconClass} />,
  own_apartment: <Building className={iconClass} />,
  own_house: <Key className={iconClass} />,
  unsicher: <HelpCircle className={iconClass} />,
};

export const SIZE_ICONS: Record<string, React.ReactNode> = {
  klein: <Minimize2 className={iconClass} />,
  mittel: <Square className={iconClass} />,
  gross: <Maximize2 className={iconClass} />,
  xl: <Expand className={iconClass} />,
  unsicher: <Ruler className={iconClass} />,
};

export const TIMEFRAME_ICONS: Record<string, React.ReactNode> = {
  asap: <Zap className={iconClass} />,
  "1-3": <Calendar className={iconClass} />,
  "4-6": <CalendarDays className={iconClass} />,
  "7-12": <CalendarClock className={iconClass} />,
  spaeter: <Clock className={iconClass} />,
  unsicher: <HelpCircle className={iconClass} />,
};

// ----- NEU: Farbwelt --------------------------------------------
export const COLOR_ICONS: Record<string, React.ReactNode> = {
  hell: <Sun className={iconClass} />,
  holz: <TreePine className={iconClass} />,
  dunkel: <Moon className={iconClass} />,
  farbig: <Palette className={iconClass} />,
  mix: <Contrast className={iconClass} />,
  unsicher: <HelpCircle className={iconClass} />,
};

// ----- NEU: Kochfeld --------------------------------------------
export const COOKTOP_ICONS: Record<string, React.ReactNode> = {
  induktion: <Zap className={iconClass} />,
  ceran: <Grid3x3 className={iconClass} />,
  gas: <Flame className={iconClass} />,
  unsicher: <HelpCircle className={iconClass} />,
};

// ----- NEU: Backofen --------------------------------------------
export const OVEN_ICONS: Record<string, React.ReactNode> = {
  "unter-kochfeld": <ArrowDown className={iconClass} />,
  augenhoehe: <ArrowUp className={iconClass} />,
  doppelt: <Copy className={iconClass} />,
  unsicher: <HelpCircle className={iconClass} />,
};

// ----- NEU: Kochstil --------------------------------------------
export const COOKSTYLE_ICONS: Record<string, React.ReactNode> = {
  allein: <User className={iconClass} />,
  paar: <Users className={iconClass} />,
  familie: <Baby className={iconClass} />,
  freunde: <PartyPopper className={iconClass} />,
  selten: <Coffee className={iconClass} />,
  unsicher: <HelpCircle className={iconClass} />,
};

export const WORKTOP_FALLBACK_ICON = <CircleDashed className={iconClass} />;
