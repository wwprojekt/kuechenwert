import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
}

interface UseExportOptions {
  filename: string;
  columns: ExportColumn[];
}

export function useExport({ filename, columns }: UseExportOptions) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Ja" : "Nein";
    if (value instanceof Date) return value.toLocaleDateString("de-DE");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const escapeCsvValue = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes(";")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const exportCSV = useCallback(
    (data: any[]) => {
      if (!data?.length) {
        toast({
          title: "Keine Daten",
          description: "Es gibt keine Daten zum Exportieren.",
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);

      try {
        // BOM for Excel UTF-8 compatibility
        const BOM = "\uFEFF";

        // Header row
        const header = columns.map((col) => escapeCsvValue(col.label)).join(";");

        // Data rows
        const rows = data.map((row) =>
          columns
            .map((col) => {
              const value = col.format
                ? col.format(row[col.key], row)
                : formatValue(row[col.key]);
              return escapeCsvValue(value);
            })
            .join(";")
        );

        const csv = BOM + [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Export erfolgreich",
          description: `${data.length} Einträge als CSV exportiert.`,
        });
      } catch (error) {
        console.error("CSV export error:", error);
        toast({
          title: "Export fehlgeschlagen",
          description: "Beim Exportieren ist ein Fehler aufgetreten.",
          variant: "destructive",
        });
      } finally {
        setIsExporting(false);
      }
    },
    [filename, columns, toast]
  );

  const exportExcel = useCallback(
    async (data: any[]) => {
      if (!data?.length) {
        toast({
          title: "Keine Daten",
          description: "Es gibt keine Daten zum Exportieren.",
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);

      try {
        // Build an HTML table that Excel can open natively
        const BOM = "\uFEFF";
        let html = `${BOM}<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  table { border-collapse: collapse; }
  th { background-color: #1f8aa2; color: white; font-weight: bold; padding: 8px 12px; border: 1px solid #ccc; }
  td { padding: 6px 12px; border: 1px solid #ddd; }
  tr:nth-child(even) { background-color: #f2f2f2; }
</style>
</head><body><table>`;

        // Header
        html += "<thead><tr>";
        columns.forEach((col) => {
          html += `<th>${col.label}</th>`;
        });
        html += "</tr></thead><tbody>";

        // Data rows
        data.forEach((row) => {
          html += "<tr>";
          columns.forEach((col) => {
            const value = col.format
              ? col.format(row[col.key], row)
              : formatValue(row[col.key]);
            html += `<td>${value.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`;
          });
          html += "</tr>";
        });

        html += "</tbody></table></body></html>";

        const blob = new Blob([html], {
          type: "application/vnd.ms-excel;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}_${new Date().toISOString().split("T")[0]}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Export erfolgreich",
          description: `${data.length} Einträge als Excel exportiert.`,
        });
      } catch (error) {
        console.error("Excel export error:", error);
        toast({
          title: "Export fehlgeschlagen",
          description: "Beim Exportieren ist ein Fehler aufgetreten.",
          variant: "destructive",
        });
      } finally {
        setIsExporting(false);
      }
    },
    [filename, columns, toast]
  );

  return { exportCSV, exportExcel, isExporting };
}
