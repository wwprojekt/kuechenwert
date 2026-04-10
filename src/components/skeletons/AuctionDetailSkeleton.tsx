import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for the AuctionDetail page.
 * Mirrors the real layout (photo + sidebar + tabs) so users
 * perceive instant page load instead of a blank spinner.
 */
export const AuctionDetailSkeleton = () => (
  <div className="min-h-screen relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
    <div className="container mx-auto px-4 max-w-7xl py-6 relative z-10">
      {/* Back button */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column – photo + tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo gallery */}
          <Card className="overflow-hidden shadow-lg">
            <Skeleton className="h-[300px] sm:h-[400px] lg:h-[500px] w-full rounded-none" />
            <div className="p-4 flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="w-16 h-16 md:w-20 md:h-20 rounded-lg flex-shrink-0" />
              ))}
            </div>
          </Card>

          {/* Tabs */}
          <div>
            <div className="grid grid-cols-4 gap-1 mb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
            <Card className="p-6 space-y-4">
              <Skeleton className="h-7 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Right column – bid sidebar */}
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            {/* Title */}
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-5 w-1/2" />

            {/* Timer */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>

            {/* Price */}
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-40" />
            </div>

            {/* Bid stats */}
            <div className="flex gap-4 pt-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Separator */}
            <Skeleton className="h-px w-full" />

            {/* Bid input */}
            <div className="space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-12 w-full rounded-md" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-10 rounded-md" />
                <Skeleton className="h-10 rounded-md" />
                <Skeleton className="h-10 rounded-md" />
              </div>
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          </Card>

          {/* Bid history */}
          <Card className="p-6 space-y-3">
            <Skeleton className="h-6 w-36" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </Card>
        </div>
      </div>
    </div>
  </div>
);
