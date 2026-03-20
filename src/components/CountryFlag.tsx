import { getCountryFlag, getCountryName } from "@/lib/geolocation";

interface CountryFlagProps {
  countryCode: string | null | undefined;
  showName?: boolean;
  className?: string;
}

export function CountryFlag({ countryCode, showName = false, className = "" }: CountryFlagProps) {
  if (!countryCode) return null;
  
  const flag = getCountryFlag(countryCode);
  const name = getCountryName(countryCode);
  
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={name}>
      <span className="text-base">{flag}</span>
      {showName && <span className="text-sm">{name}</span>}
    </span>
  );
}
