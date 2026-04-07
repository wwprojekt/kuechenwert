import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Preset = "today" | "week" | "month" | "quarter" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "week", label: "7 Tage" },
  { key: "month", label: "30 Tage" },
  { key: "quarter", label: "90 Tage" },
];

function getPresetRange(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (preset) {
    case "today": return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to };
    case "week": return { from: new Date(Date.now() - 7 * 86400000), to };
    case "month": return { from: new Date(Date.now() - 30 * 86400000), to };
    case "quarter": return { from: new Date(Date.now() - 90 * 86400000), to };
    default: return { from: new Date(Date.now() - 30 * 86400000), to };
  }
}

interface AdminDateFilterProps {
  onFilter: (from: Date | null, to: Date | null) => void;
  activePreset?: Preset | null;
}

export function AdminDateFilter({ onFilter, activePreset: externalPreset }: AdminDateFilterProps) {
  const [preset, setPreset] = useState<Preset | null>(externalPreset || null);
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const applyPreset = (p: Preset) => {
    const range = getPresetRange(p);
    setPreset(p);
    onFilter(range.from, range.to);
    setOpen(false);
  };

  const applyCustom = () => {
    if (customFrom) {
      setPreset("custom");
      onFilter(new Date(customFrom), customTo ? new Date(customTo + "T23:59:59") : new Date());
      setOpen(false);
    }
  };

  const clear = () => {
    setPreset(null);
    setCustomFrom("");
    setCustomTo("");
    onFilter(null, null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={preset ? "default" : "outline"} size="sm" className="h-8 gap-1.5 text-xs">
          <Calendar className="w-3.5 h-3.5" />
          {preset ? PRESETS.find(p => p.key === preset)?.label || "Zeitraum" : "Zeitraum"}
          {preset && (
            <X className="w-3 h-3 ml-0.5 hover:text-destructive" onClick={(e) => { e.stopPropagation(); clear(); }} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">Schnellauswahl</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <Badge
                key={p.key}
                variant={preset === p.key ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </Badge>
            ))}
          </div>
          <div className="border-t pt-2 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Benutzerdefiniert</p>
            <div className="flex gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="flex-1 text-xs border rounded px-2 py-1 bg-background" />
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="flex-1 text-xs border rounded px-2 py-1 bg-background" />
            </div>
            <Button size="sm" className="w-full h-7 text-xs" onClick={applyCustom} disabled={!customFrom}>
              Anwenden
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
