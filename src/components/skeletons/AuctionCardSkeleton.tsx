/**
 * Skeleton loading state for auction/motorhome cards
 * Matches the layout of MotorhomeCard component
 */

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const AuctionCardSkeleton = () => (
  <Card className="overflow-hidden border-2 flex flex-col h-full">
    {/* Image placeholder */}
    <div className="relative">
      <Skeleton className="aspect-video w-full rounded-none" />
      {/* Badge placeholders */}
      <div className="absolute top-3 left-3 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {/* Timer placeholder */}
      <div className="absolute bottom-3 right-3">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
    
    <CardContent className="p-4 space-y-3 flex-1">
      {/* Title */}
      <Skeleton className="h-5 w-3/4" />
      
      {/* Subtitle / specs */}
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      
      {/* Price section */}
      <div className="pt-2 border-t mt-auto">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-7 w-32" />
      </div>
      
      {/* Bid info */}
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </CardContent>
  </Card>
);

/**
 * Grid of skeleton cards for auction/listing pages
 */
export const AuctionCardSkeletonGrid = ({ count = 6 }: { count?: number }) => (
  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <AuctionCardSkeleton key={i} />
    ))}
  </div>
);

export default AuctionCardSkeleton;
