import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MONTHS = [
  { value: "01", label: "Januar" },
  { value: "02", label: "Februar" },
  { value: "03", label: "März" },
  { value: "04", label: "April" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Dezember" },
];

interface MonthYearPickerProps {
  /** Label text shown above the picker */
  label?: string;
  /** Current value in YYYY-MM format (e.g. "2026-04") or empty string / null / undefined */
  value?: string | null;
  /** Called with the new value in YYYY-MM format, or empty string when cleared */
  onChange: (value: string) => void;
  /** Minimum year to show in the dropdown (default: current year - 5) */
  minYear?: number;
  /** Maximum year to show in the dropdown (default: current year + 10) */
  maxYear?: number;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional className for the wrapper */
  className?: string;
  /** ID for accessibility */
  id?: string;
}

/**
 * MonthYearPicker - Two dropdowns (Month + Year) for selecting a month/year combination.
 * 
 * Works consistently across all browsers (unlike input type="month" which fails on Safari macOS).
 * Value format: "YYYY-MM" (e.g. "2026-04")
 * For DB storage, append "-01" to get a valid DATE: "2026-04-01"
 */
export function MonthYearPicker({
  label,
  value,
  onChange,
  minYear,
  maxYear,
  disabled = false,
  className,
  id,
}: MonthYearPickerProps) {
  const currentYear = new Date().getFullYear();
  const yearStart = minYear ?? currentYear - 5;
  const yearEnd = maxYear ?? currentYear + 10;

  // Parse current value
  const parsedMonth = value ? value.substring(5, 7) : "";
  const parsedYear = value ? value.substring(0, 4) : "";

  // Generate year options
  const years = React.useMemo(() => {
    const result: string[] = [];
    for (let y = yearEnd; y >= yearStart; y--) {
      result.push(String(y));
    }
    return result;
  }, [yearStart, yearEnd]);

  const handleMonthChange = (newMonth: string) => {
    if (newMonth === "__clear__") {
      onChange("");
      return;
    }
    const year = parsedYear || String(currentYear);
    onChange(`${year}-${newMonth}`);
  };

  const handleYearChange = (newYear: string) => {
    if (newYear === "__clear__") {
      onChange("");
      return;
    }
    const month = parsedMonth || "01";
    onChange(`${newYear}-${month}`);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="flex gap-2">
        <Select
          value={parsedMonth || undefined}
          onValueChange={handleMonthChange}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1" id={id}>
            <SelectValue placeholder="Monat" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={parsedYear || undefined}
          onValueChange={handleYearChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Jahr" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
