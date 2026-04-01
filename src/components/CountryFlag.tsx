import { getCountryName } from "@/lib/geolocation";

interface CountryFlagProps {
  countryCode: string | null | undefined;
  showName?: boolean;
  showCode?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * CountryFlag - Zeigt eine SVG-Flagge des Landes an (via flag-icons CSS).
 * Funktioniert auf allen Betriebssystemen (Windows, Mac, Linux, Mobile).
 */
export function CountryFlag({ 
  countryCode, 
  showName = false, 
  showCode = false,
  className = "",
  size = "md"
}: CountryFlagProps) {
  if (!countryCode) return null;
  
  const code = countryCode.toLowerCase();
  const name = getCountryName(countryCode);
  
  const sizeClasses = {
    sm: "w-4 h-3",
    md: "w-5 h-4",
    lg: "w-6 h-5",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={name}>
      <span 
        className={`fi fi-${code} ${sizeClasses[size]} inline-block rounded-sm`}
        style={{ backgroundSize: "cover", backgroundPosition: "center" }}
      />
      {showCode && <span className="text-xs font-medium text-muted-foreground">{countryCode.toUpperCase()}</span>}
      {showName && <span className="text-sm">{name}</span>}
    </span>
  );
}
