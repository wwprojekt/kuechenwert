/**
 * Skeleton loading state for table rows
 * Used in admin tables and data grids
 */

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

interface TableRowSkeletonProps {
  /** Number of columns in the table */
  columns?: number;
  /** Whether to show an action column at the end */
  hasActions?: boolean;
}

export const TableRowSkeleton = ({ columns = 5, hasActions = true }: TableRowSkeletonProps) => (
  <TableRow>
    {Array.from({ length: columns }).map((_, i) => (
      <TableCell key={i}>
        <Skeleton 
          className={`h-4 ${i === 0 ? 'w-32' : i === columns - 1 && hasActions ? 'w-20' : 'w-24'}`} 
        />
      </TableCell>
    ))}
    {hasActions && (
      <TableCell>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </TableCell>
    )}
  </TableRow>
);

/**
 * Multiple skeleton rows for table body
 */
export const TableBodySkeleton = ({ 
  rows = 5, 
  columns = 5, 
  hasActions = true 
}: { 
  rows?: number; 
  columns?: number; 
  hasActions?: boolean;
}) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <TableRowSkeleton key={i} columns={columns} hasActions={hasActions} />
    ))}
  </>
);

/**
 * Complete table skeleton with header
 */
export const TableSkeleton = ({ 
  rows = 5, 
  columns = 5 
}: { 
  rows?: number; 
  columns?: number; 
}) => (
  <div className="rounded-md border">
    {/* Header skeleton */}
    <div className="border-b bg-muted/50 px-4 py-3">
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
    </div>
    {/* Body skeleton */}
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? 'w-32' : 'w-24'}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default TableRowSkeleton;
