import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, MapPin, Gauge, Cog, Shield, Zap, Globe } from "lucide-react";
import { useState, useEffect } from "react";

export interface FilterState {
  priceRange: [number, number];
  yearRange: [number, number];
  vehicleTypes: string[];
  brand: string | null;
  beds: string | null;
  searchQuery: string;
  // New filters for Phase 3
  countries: string[];
  mileageMin: number | null;
  mileageMax: number | null;
  transmission: string | null;
  accidentFree: boolean | null;
  buyNowOnly: boolean;
}

interface FilterSidebarProps {
  onFilterChange: (filters: FilterState) => void;
  resultCount: number;
  countryCounts?: Record<string, number>;
}

const COUNTRIES = [
  { code: 'DE', name: 'Deutschland' },
  { code: 'AT', name: 'Österreich' },
  { code: 'CH', name: 'Schweiz' },
  { code: 'NL', name: 'Niederlande' },
  { code: 'BE', name: 'Belgien' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'IT', name: 'Italien' },
  { code: 'ES', name: 'Spanien' },
];

export const FilterSidebar = ({ onFilterChange, resultCount, countryCounts }: FilterSidebarProps) => {
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000]);
  const [yearRange, setYearRange] = useState<[number, number]>([2015, 2024]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [brand, setBrand] = useState<string | null>(null);
  const [beds, setBeds] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New filter states
  const [countries, setCountries] = useState<string[]>([]);
  const [mileageMin, setMileageMin] = useState<number | null>(null);
  const [mileageMax, setMileageMax] = useState<number | null>(null);
  const [transmission, setTransmission] = useState<string | null>(null);
  const [accidentFree, setAccidentFree] = useState<boolean | null>(null);
  const [buyNowOnly, setBuyNowOnly] = useState(false);

  const brands = ["Hymer", "Weinsberg", "Knaus", "Bürstner", "Dethleffs", "Carado", "Fiat", "Pössl", "Adria", "Carthago"];

  const handleVehicleTypeToggle = (type: string) => {
    setVehicleTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleCountryToggle = (countryCode: string) => {
    setCountries(prev =>
      prev.includes(countryCode) ? prev.filter(c => c !== countryCode) : [...prev, countryCode]
    );
  };

  // Auto-apply filters whenever any filter state changes
  useEffect(() => {
    onFilterChange({
      priceRange,
      yearRange,
      vehicleTypes,
      brand,
      beds,
      searchQuery,
      countries,
      mileageMin,
      mileageMax,
      transmission,
      accidentFree,
      buyNowOnly,
    });
  }, [priceRange, yearRange, vehicleTypes, brand, beds, searchQuery, countries, mileageMin, mileageMax, transmission, accidentFree, buyNowOnly, onFilterChange]);

  const resetFilters = () => {
    setPriceRange([0, 500000]);
    setYearRange([2015, 2024]);
    setVehicleTypes([]);
    setBrand(null);
    setBeds(null);
    setSearchQuery("");
    setCountries([]);
    setMileageMin(null);
    setMileageMax(null);
    setTransmission(null);
    setAccidentFree(null);
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
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
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
              placeholder="Marke, Modell..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Buy Now Toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <Label htmlFor="buyNowOnly" className="text-sm font-medium cursor-pointer">
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
              max={500000}
              step={5000}
              value={priceRange}
              onValueChange={(value) => setPriceRange(value as [number, number])}
              className="py-4"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{priceRange[0].toLocaleString("de-DE")} €</span>
              <span>{priceRange[1].toLocaleString("de-DE")} €</span>
            </div>
          </div>

          {/* Year Range */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">Baujahr</Label>
            <Slider
              min={2010}
              max={2024}
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

          {/* Mileage Range */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Kilometerstand
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  type="number"
                  placeholder="Min km"
                  value={mileageMin || ""}
                  onChange={(e) => setMileageMin(e.target.value ? parseInt(e.target.value) : null)}
                  min={0}
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Max km"
                  value={mileageMax || ""}
                  onChange={(e) => setMileageMax(e.target.value ? parseInt(e.target.value) : null)}
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Transmission */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Cog className="w-4 h-4" />
              Getriebe
            </Label>
            <Select value={transmission || undefined} onValueChange={(value) => setTransmission(value || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Getriebe" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="Schaltgetriebe">Schaltgetriebe</SelectItem>
                <SelectItem value="Automatik">Automatik</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Accident Free */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Fahrzeugzustand
            </Label>
            <Select 
              value={accidentFree === null ? undefined : accidentFree ? "yes" : "no"} 
              onValueChange={(value) => setAccidentFree(value === undefined ? null : value === "yes")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alle Fahrzeuge" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="yes">Nur unfallfrei</SelectItem>
                <SelectItem value="no">Alle anzeigen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Type */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">Fahrzeugtyp</Label>
            <div className="space-y-2">
              {["Teilintegriert", "Vollintegriert", "Kastenwagen", "Alkoven", "Campingbus"].map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox 
                    id={type} 
                    checked={vehicleTypes.includes(type)}
                    onCheckedChange={() => handleVehicleTypeToggle(type)}
                  />
                  <label
                    htmlFor={type}
                    className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-smooth"
                  >
                    {type}
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
                <div key={country.code} className="flex items-center justify-between">
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
                  {countryCounts && countryCounts[country.code] !== undefined && (
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
            <Select value={brand || undefined} onValueChange={(value) => setBrand(value || null)}>
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

          {/* Beds */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">Schlafplätze</Label>
            <Select value={beds || undefined} onValueChange={(value) => setBeds(value || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Beliebig" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="2">2 Personen</SelectItem>
                <SelectItem value="4">4 Personen</SelectItem>
                <SelectItem value="6">6+ Personen</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="border-2 bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">{resultCount}</div>
            <p className="text-sm text-muted-foreground">Verfügbare Fahrzeuge</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
