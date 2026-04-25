import { Separator } from "@/components/ui/separator";
import { useCommissionFromTiers } from "@/lib/commissionCalculator";

interface AuctionCommissionOverviewProps {
  currentBid: number;
}

/**
 * Standalone commission overview for the auction sidebar.
 * The useCommissionFromTiers hook lives HERE, so it only runs
 * when the parent (AuctionDetail) actually renders this component
 * – i.e. after auction data is loaded AND the user is a dealer/admin.
 *
 * This eliminates the risk of hook-order violations in AuctionDetail
 * and avoids unnecessary commission_tiers DB fetches for anonymous/private users.
 */
export const AuctionCommissionOverview = ({ currentBid }: AuctionCommissionOverviewProps) => {
  const commissionInfo = useCommissionFromTiers(currentBid);

  if (commissionInfo.isLoading || commissionInfo.commission <= 0) {
    return null;
  }

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Kostenübersicht</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Aktuelles Gebot</span>
            <span className="font-medium">€{currentBid.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Provision{commissionInfo.isMinApplied ? ' (mind.)' : ''}
            </span>
            <span className="font-medium">€{commissionInfo.commission.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Gesamtkosten (netto)</span>
          <span className="text-lg font-bold text-primary">€{commissionInfo.totalCost.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
        </div>
        <p className="text-xs text-muted-foreground">zzgl. MwSt. auf die Provision</p>
      </div>
    </>
  );
};
