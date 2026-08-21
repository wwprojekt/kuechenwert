import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Palette, Globe, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { DEFAULT_KITCHEN_BRANDS, KITCHEN_FORMS } from "@/lib/kitchen-listing";

// FilterState for the kitchens marketplace (`/kaufen`).
//
// Historisch enthielt dieser Typ noch Caravan-Felder (`vehicleTypes`,
// `mileageMin/Max`, `transmission`, `accidentFree`, `beds`). Die Felder
// werden nicht mehr in der UI gezeigt und nicht mehr in der Query
// angewendet. Sie sind 2026-05-01 entfernt worden — die Seite ist jetzt
// ein Küchen-Marketplace.
export interface FilterState {
  priceRange: [number, number];
  yearRange: [number, number];
  kitchenForms: string[];
  brand: string | null;
  style: string | null;
  searchQuery: string;
  countries: string[];
  buyNowOnly: boolean;
}

interface FilterSidebarProps {
  onFilterChange: (filters: FilterState) => void;
  resultCount: number;
  countryCounts?: Record<string, number>;
  availableBrands?: string[];
}

const COUNTRIES = [
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "CH", name: "Schweiz" },
];

// Küchenstile. Wird primär als Filter-Hinweis für SEO/Browse genutzt —
// die eigentlichen Angebote sind markenunabhängig; Studios pflegen Stil
// i.d.R. im Freitext. Wir filtern clientseitig über den Titel.
const KITCHEN_STYLES = [
  "Modern",
  "Landhaus",
  "Klassisch",
  "Minimalistisch",
  "Industrial",
  "Skandinavisch",
];

export const FilterSidebar = ({
  onFilterChange,
  resultCount,
  countryCounts,
  availableBrands,
}: FilterSidebarProps) => {
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);
  const [yearRange, setYearRange] = useState<[number, number]>([2000, 2026]);
  const [kitchenForms, setKitchenForms] = useState<string[]>([]);
  const [brand, setBrand] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [buyNowOnly, setBuyNowOnly] = useState(false);

  const brands =
    availableBrands && availableBrands.length > 0
      ? availableBrands
      : DEFAULT_KITCHEN_BRANDS;

  const handleFormToggle = (form: string) => {
    setKitchenForms((prev) =>
      prev.includes(form) ? prev.filter((t) => t !== form) : [...prev, form]
    );
  };

  const handleCountryToggle = (countryCode: string) => {
    setCountries((prev) =>
      prev.includes(countryCode)
        ? prev.filter((c) => c !== countryCode)
        : [...prev, countryCode]
    );
  };

  useEffect(() => {
    onFilterChange({
      priceRange,
      yearRange,
      kitchenForms,
      brand,
      style,
      searchQuery,
      countries,
      buyNowOnly,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRange, yearRange, kitchenForms, brand, style, searchQuery, countries, buyNowOnly]);

  const resetFilters = () => {
    setPriceRange([0, 50000]);
    setYearRange([2000, 2026]);
    setKitchenForms([]);
    setBrand(null);
    setStyle(null);
    setSearchQuery("");
    setCountries([]);
    setBuyNowOnly(false);
  };

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filter
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-sm min-h-[36px] px-3"
              onClick={resetFilters}
            >
              Zurücksetzen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Suche</Label>
            <Input
              type="text"
              placeholder="Marke, Modell, Stil..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Buy Now Toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <Label
                htmlFor="buyNowOnly"
                className="text-sm font-medium cursor-pointer"
              >
                Nur Sofortkauf
              </Label>
            </div>
            <Switch
              id="buyNowOnly"
              checked={buyNowOnly}
              onCheckedChange={setBuyNowOnly}
            />
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Preis</Label>
            <Slider
              min={0}
              max={50000}
              step={500}
              value={priceRange}
              onValueChange={(value) => setPriceRange(value as [number, number])}
              className="py-4"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{priceRange[0].toLocaleString("de-DE")} €</span>
              <span>{priceRange[1].toLocaleString("de-DE")} €</span>
            </div>
          </div>

          {/* Production Year */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">Produktionsjahr</Label>
            <Slider
              min={2000}
              max={2026}
              step={1}
              value={yearRange}
              onValueChange={(value) => setYearRange(value as [number, number])}
              className="py-4"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{yearRange[0]}</span>
              <span>{yearRange[1]}</span>
            </div>
          </div>

          {/* Kitchen Form */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">Küchenform</Label>
            <div className="space-y-2">
              {KITCHEN_FORMS.map((form) => (
                <div key={form} className="flex items-center space-x-2">
                  <Checkbox
                    id={form}
                    checked={kitchenForms.includes(form)}
                    onCheckedChange={() => handleFormToggle(form)}
                  />
                  <label
                    htmlFor={form}
                    className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                  >
                    {form}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Country */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Standort
            </Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {COUNTRIES.map((country) => (
                <div
                  key={country.code}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`country-${country.code}`}
                      checked={countries.includes(country.code)}
                      onCheckedChange={() => handleCountryToggle(country.code)}
                    />
                    <label
                      htmlFor={`country-${country.code}`}
                      className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                    >
                      {country.name}
                    </label>
                  </div>
                  {countryCounts &&
                    countryCounts[country.code] !== undefined && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {countryCounts[country.code]}
                      </span>
                    )}
                </div>
              ))}
            </div>
          </div>

          {/* Brand */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">Marke</Label>
            <Select
              value={brand || undefined}
              onValueChange={(value) => setBrand(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alle Marken" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {brands.map((brandOption) => (
                  <SelectItem key={brandOption} value={brandOption}>
                    {brandOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Style */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Stil
            </Label>
            <Select
              value={style || undefined}
              onValueChange={(value) => setStyle(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Beliebig" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {KITCHEN_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="border-2 bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {resultCount}
            </div>
            <p className="text-sm text-muted-foreground">Verfügbare Küchen</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
