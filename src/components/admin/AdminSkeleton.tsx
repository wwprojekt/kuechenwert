import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <Card className="border">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <Shimmer className="w-9 h-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="h-5 w-10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Shimmer className="w-4 h-4 rounded" />
          <Shimmer className="h-4 w-28" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 p-2">
            <Shimmer className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Shimmer className="h-3 w-3/4" />
              <Shimmer className="h-2.5 w-1/2" />
            </div>
            <Shimmer className="h-4 w-12 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, j) => (
            <Shimmer key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <Card className="border">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shimmer className="w-4 h-4 rounded" />
          <Shimmer className="h-3 w-20" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Shimmer className="h-6 w-12" />
              <Shimmer className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
