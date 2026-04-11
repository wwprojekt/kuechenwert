# Array Safety Analysis - AuctionDetail.tsx

## Already Fixed:
- Line 551: `photos` - Already wrapped with `Array.isArray()` check

## bids Array:
- `bids` is initialized as `useState<BidWithBidder[]>([])` - always an array
- `setBids(data)` in fetchBids (line 201) - data comes from Supabase, could be non-array
- `setBids((prev) => [newBid, ...prev])` in real-time handler (line 241) - prev is always array

## Issues to Fix:
1. **Line 200-201**: `setBids(data)` - data from Supabase could be non-array. Need `Array.isArray()` check.
2. **Line 182**: `setAuction(data)` - data from Supabase `.maybeSingle()` - returns single object, OK.
3. **Line 549**: `motorhome = auction.motorhome` - could be non-object if Supabase returns differently.
4. **Line 1038/1079**: `motorhome[key]` - accessing dynamic keys, not array issue.

## Conclusion:
The main risk is in `fetchBids` where `data` from Supabase might not be an array.
The `bids` state itself is always initialized as `[]`, so all render-time accesses are safe.
The `photos` array is already protected.

The real safety concern is the `setBids(data)` call and the `setAuction(data)` call.
Also the `motorhome.seller` access needs null-checking (already done with `motorhome.seller &&`).
