import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportButtonProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  isExporting?: boolean;
  size?: "sm" | "default" | "lg";
}

export function ExportButton({
  onExportCSV,
  onExportExcel,
  isExporting = false,
  size = "sm",
}: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exportiert..." : "Exportieren"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Als CSV exportieren
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel}>
          <Download className="h-4 w-4 mr-2" />
          Als Excel exportieren
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
