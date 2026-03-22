import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";

interface SiteLogoProps {
  /** 
   * Logo variant:
   * - "icon-only": Just the icon (for collapsed sidebars)
   * - "icon-text": Icon with site name and tagline (for header)
   * - "icon-text-compact": Icon with site name only (for sidebars)
   * - "footer": Inverted colors for dark backgrounds
   */
  variant?: "icon-only" | "icon-text" | "icon-text-compact" | "footer";
  /** Link destination (default: "/") */
  linkTo?: string;
  /** Custom icon size class */
  iconSize?: string;
  /** Custom class name */
  className?: string;
  /** Whether to wrap in a Link component */
  asLink?: boolean;
}

export function SiteLogo({
  variant = "icon-text",
  linkTo = "/",
  iconSize,
  className = "",
  asLink = true,
}: SiteLogoProps) {
  const { settings } = useSettings();

  // Use settings logo_url or fallback to /logo.png
  const logoUrl = settings?.logo_url || "/logo.png";
  const siteName = settings?.site_name || "CaravanWert";
  const siteTagline = settings?.site_tagline || "Deutschlands führende Wohnmobil-Handelsplattform";

  // Determine icon size based on variant
  const getIconSizeClass = () => {
    if (iconSize) return iconSize;
    switch (variant) {
      case "icon-only":
        return "h-8 w-8";
      case "icon-text":
        return "h-14 w-14";
      case "icon-text-compact":
        return "h-10 w-10";
      case "footer":
        return "h-14 w-14";
      default:
        return "h-10 w-10";
    }
  };

  const renderContent = () => {
    switch (variant) {
      case "icon-only":
        return (
          <img
            src={logoUrl}
            alt={siteName}
            className={`${getIconSizeClass()} object-contain`}
          />
        );

      case "icon-text":
        return (
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={siteName}
              className={`${getIconSizeClass()} object-contain flex-shrink-0`}
            />
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-foreground leading-tight tracking-tight">
                {siteName}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight font-medium whitespace-nowrap">
                {siteTagline}
              </span>
            </div>
          </div>
        );

      case "icon-text-compact":
        return (
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt={siteName}
              className={`${getIconSizeClass()} object-contain flex-shrink-0`}
            />
            <span className="text-xl font-bold text-foreground leading-tight">
              {siteName}
            </span>
          </div>
        );

      case "footer":
        return (
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={siteName}
              className={`${getIconSizeClass()} object-contain flex-shrink-0`}
              style={{ filter: 'none' }}
            />
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-white leading-tight tracking-tight">
                {siteName}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight font-medium whitespace-nowrap">
                {siteTagline}
              </span>
            </div>
          </div>
        );

      default:
        return (
          <img
            src={logoUrl}
            alt={siteName}
            className={`${getIconSizeClass()} object-contain`}
          />
        );
    }
  };

  if (asLink) {
    return (
      <Link
        to={linkTo}
        className={`flex items-center hover:opacity-90 transition-opacity ${className}`}
      >
        {renderContent()}
      </Link>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      {renderContent()}
    </div>
  );
}

export default SiteLogo;
