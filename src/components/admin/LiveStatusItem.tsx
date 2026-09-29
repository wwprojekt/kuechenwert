import { CheckCircle2, XCircle } from "lucide-react";

interface LiveStatusItemProps {
  label: string;
  ok: boolean;
  detail: string;
}

export default function LiveStatusItem({ label, ok, detail }: LiveStatusItemProps) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
        ) : (
          <XCircle className="w-4 h-4 text-destructive" aria-hidden="true" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{detail}</p>
    </div>
  );
}
