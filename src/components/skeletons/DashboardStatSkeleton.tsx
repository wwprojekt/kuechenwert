/**
 * Skeleton loading state for dashboard stat cards
 * Matches common dashboard KPI/metric card layouts
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const DashboardStatSkeleton = () => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      {/* Title */}
      <Skeleton className="h-4 w-24" />
      {/* Icon */}
      <Skeleton className="h-4 w-4 rounded" />
    </CardHeader>
    <CardContent>
      {/* Main value */}
      <Skeleton className="h-8 w-20 mb-1" />
      {/* Subtitle/change indicator */}
      <Skeleton className="h-3 w-32" />
    </CardContent>
  </Card>
);

/**
 * Grid of stat skeleton cards for dashboards
 */
export const DashboardStatSkeletonGrid = ({ count = 4 }: { count?: number }) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <DashboardStatSkeleton key={i} />
    ))}
  </div>
);

/**
 * Large stat card skeleton (for featured metrics)
 */
export const DashboardStatSkeletonLarge = () => (
  <Card className="col-span-2">
    <CardHeader>
      <Skeleton className="h-5 w-32 mb-2" />
      <Skeleton className="h-4 w-48" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-12 w-36 mb-4" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </CardContent>
  </Card>
);

export default DashboardStatSkeleton;
