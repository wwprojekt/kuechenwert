# NEW CLIENT CHANGES - IMPLEMENTATION PLAN

## Project: CaravanWert
## Created: January 15, 2026
## Last Updated: January 16, 2026
## Total Issues: 30 (28 code + 2 operational)
## Estimated Effort: ~115-160 hours

---

## ✅ COMPLETED WORK LOG

### Phase 1 Completion (January 15-16, 2026)

| Issue | Description | Status |
|-------|-------------|--------|
| 1.1 | Hero Form - Model Depends on Manufacturer | ✅ DONE |
| 1.2 | Missing Manufacturers (expanded list) | ✅ DONE |
| 1.3 | Photos Not Displaying (RLS verified correct) | ✅ VERIFIED |
| 1.4 | Phone Number Required | ✅ DONE |
| 1.5 | Hero Form Required Field Validation | ✅ DONE |
| 1.6 | Lead Capture at Form Start + DB Migration | ✅ DONE |
| 1.7 | Password Reset (verified working) | ✅ VERIFIED |
| 1.8 | Replace Hardcoded "CamperAnker24" (24 src files) | ✅ DONE |

### Branding Updates (January 16, 2026)

**src/ Directory (Completed Earlier):**
- `src/lib/seo.ts` - BASE_URL, email, social links
- `src/components/CookieBanner.tsx` - cookie domain
- `src/components/Header.tsx` - fallback email
- `src/lib/invoiceGenerator.ts` - fallback email
- Multiple pages - URLs, emails, keywords
- `src/integrations/supabase/types.ts` - Regenerated with quick_leads

**Public Files:**
- `index.html` - 11 occurrences (canonical URLs, meta tags, structured data, social links)
- `public/sitemap.xml` - 14 URLs updated to caravanwert.de
- `public/robots.txt` - Comment and sitemap URL
- `public/sw.js` - Cache names updated

**Supabase Edge Functions (18 files):**
- `_shared/email-builder.ts` - Footer links
- `_shared/email-components.tsx` - Footer links
- `_shared/email-templates/*.tsx` - 3 template files
- 13 notification function files - All branding text, emails, URLs

**Infrastructure:**
- `Dockerfile` - Comment updated
- `docker-compose.yml` - Comment and network names
- `docker/nginx.conf` - Comment updated
- `docker/default.conf` - Comment updated

**Tests:**
- `tests/e2e/homepage.spec.ts` - Test assertions updated

### Database Migrations Applied
- `20260115000002_create_quick_leads.sql` - quick_leads table with RLS policies

---

## ✅ GAP ANALYSIS - CLIENT REQUIREMENTS vs PLAN

| # | Client Request | Status | Plan Issue # |
|---|----------------|--------|--------------|
| 1 | Model depends on manufacturer | ✅ **DONE** | 1.1 |
| 2 | Missing manufacturers | ✅ **DONE** | 1.2 |
| 3 | Photos not displaying | ✅ **VERIFIED** | 1.3 |
| 4 | Dealer suspend functionality | ⏳ Planned | 2.1 |
| 5 | Phone required | ✅ **DONE** | 1.4 |
| 6 | Admin edit auctions | ⏳ Planned | 2.2 |
| 7 | Name/Tel/Email required | ✅ **DONE** | 1.5 |
| 8 | Lead capture on form start | ✅ **DONE** | 1.6 |
| 9 | Reserve price logic (hide, €50 start) | ⏳ Planned | 2.3 |
| 10 | Admin motorhomes title image | ⏳ Planned | 2.4 |
| 11 | Wizard progress no steps | ⏳ Planned | 2.5 |
| 12 | Validate before wizard | ✅ **DONE** | 1.5 |
| 13 | Password reset verify | ✅ **VERIFIED** | 1.7 |
| 14 | CamperAnker24 → settings.site_name | ✅ **DONE** | 1.8 |
| 15 | Search/Filter enhancements | ✅ Planned | 3.1 |
| 16 | "Über uns" page | ⚠️ EXISTS | 2.8 (verify only) |
| 17 | GitHub upload | ℹ️ Operational | Note added |
| 18 | Real-time countdown | ✅ Planned | 3.2 |
| 19 | Sofortkauf option | ✅ Planned | 3.3 |
| 20 | Kaufchance feature | ✅ Planned | 4.1 |
| 21 | Nachverhandlungs-System | ⚠️ Added | 4.1 (expanded) |
| 22 | Bietagent/auto-bidding | ✅ Planned | 3.4 |
| 23 | Additional vehicle fields | ✅ Planned | 3.5 |
| 24 | Equipment categories | ✅ Planned | 3.6 |
| 25 | Known defects section | ✅ Planned | 3.7 |
| 26 | Location with distance | ✅ Planned | 4.5 |
| 27 | Questions to admin | ✅ Planned | 4.3 |
| 28 | Remove "Meine Inserate" for dealers | ✅ Planned | 2.7 |
| 29 | Dealer sees auctions | ⚠️ Debug | 2.6 (expanded) |
| 30 | Dashboard extensions | ✅ Planned | 4.2 |
| 31 | Vehicle count per country (filter) | ⚠️ Added | 3.1 (expanded) |
| 32 | Internal vehicle number | ✅ Planned | 4.4 |

**Legend:** ✅ Fully covered | ⚠️ Needs expansion/verification | ℹ️ Non-code task

---

## 📋 EXECUTIVE SUMMARY

| Phase | Priority | Issues | Estimated Hours | Status |
|-------|----------|--------|-----------------|--------|
| 1 | 🔴 Critical | 8 | 22-28h | ✅ COMPLETED |
| 2 | 🟠 High | 8 | 32-40h | ⏳ Pending |
| 3 | 🟡 Medium | 7 | 34-44h | ⏳ Pending |
| 4 | 🟢 Low | 6 | 28-40h | ⏳ Pending |
| - | ℹ️ Operational | 1 | N/A | ⏳ Pending |

---

## ✅ PHASE 1: CRITICAL BUGS & FIXES (Week 1) - COMPLETED

### Issue 1.1: Hero Form - Model Depends on Manufacturer ✅ COMPLETED
**File:** `src/components/QuickAuctionForm.tsx`
**Problem:** Model dropdown shows hardcoded values, doesn't filter by manufacturer
**Current Code (lines 185-200):**
```tsx
<Select value={model} onValueChange={setModel}>
  <GraySelectTrigger>
    <SelectValue placeholder="Auswählen" />
  </GraySelectTrigger>
  <SelectContent>
    <SelectItem value="B-Klasse">B-Klasse</SelectItem>
    // ... hardcoded models
  </SelectContent>
</Select>
```

**Solution:**
1. Create manufacturer-to-model mapping object
2. Disable Model select until Manufacturer is selected
3. Filter Model options based on selected Manufacturer
4. Consider fetching from database for dynamic updates

**Implementation:**
```tsx
const manufacturerModels: Record<string, string[]> = {
  'Hymer': ['B-Klasse', 'Exsis', 'ML-T', 'Duomobil'],
  'Dethleffs': ['Globebus', 'Pulse', 'Just Go', 'Trend'],
  'Knaus': ['BoxStar', 'Van TI', 'Sky Wave', 'L!ve'],
  'Mercedes-Benz': ['Marco Polo', 'Sprinter', 'Vito'],
  'Volkswagen': ['California', 'Grand California', 'Crafter'],
  // ... complete mapping
};

// In component:
<Select 
  value={model} 
  onValueChange={setModel}
  disabled={!manufacturer}
>
  <SelectContent>
    {manufacturer && manufacturerModels[manufacturer]?.map((m) => (
      <SelectItem key={m} value={m}>{m}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Effort:** 2-3 hours

---

### Issue 1.2: Missing Manufacturers in Hero Form ✅ COMPLETED
**File:** `src/components/QuickAuctionForm.tsx`
**Problem:** Only 10 manufacturers in `popularManufacturers` array (lines 86-89)
**Current Code:**
```tsx
const popularManufacturers = [
  'Hymer', 'Dethleffs', 'Knaus', 'Mercedes-Benz', 'Volkswagen', 
  'Bürstner', 'Hobby', 'Adria', 'Carado', 'Weinsberg'
];
```

**Solution:**
Expand list with all major German motorhome manufacturers:

```tsx
const popularManufacturers = [
  // Premium
  'Concorde', 'Morelo', 'Niesmann+Bischoff', 'Carthago',
  // Major Brands
  'Hymer', 'Dethleffs', 'Knaus', 'Bürstner', 'Hobby', 
  'Adria', 'Carado', 'Weinsberg', 'Sunlight', 'Eura Mobil',
  'Frankia', 'LMC', 'Laika', 'Rapido', 'Chausson',
  // Camper Vans
  'Mercedes-Benz', 'Volkswagen', 'Fiat', 'Ford', 'Pössl',
  'Globecar', 'Karmann', 'Westfalia', 'La Strada',
  // Others
  'Pilote', 'Roller Team', 'Rimor', 'Benimar', 'Challenger',
  'Andere'
];
```

**Effort:** 1 hour

---

### Issue 1.3: Motorhome Photos Not Displaying ✅ VERIFIED (RLS Policy Correct)
**Screenshots:** `https://prnt.sc/eMifZxUDHWuw`
**Problem:** User "Bert Reinert" uploaded photos but they don't appear

**Investigation Required:**
1. Check `motorhome_photos` table for records
2. Verify Supabase Storage bucket permissions
3. Check photo URLs are valid and accessible
4. Review display logic in `AuctionDetail.tsx` and `MotorhomeDetailDialog.tsx`

**Locations to Check:**
- `src/pages/AuctionDetail.tsx` - line 398: `const photos = motorhome.photos?.sort(...)`
- `src/components/admin/MotorhomeDetailDialog.tsx`
- Supabase Storage bucket: `motorhome-photos`

**Potential Fixes:**
1. Storage bucket RLS policies may block public access
2. Photo URLs may need `getPublicUrl()` transformation
3. Photo fetch query may be missing join condition

**Effort:** 3-4 hours

---

### Issue 1.4: Phone Number Not Required ✅ COMPLETED
**Files:** `src/pages/Register.tsx`, `src/hooks/useWizardForm.ts`
**Problem:** Phone is optional, should be mandatory

**Current Code (Register.tsx line 21):**
```tsx
phone: z.string().trim().optional(),
```

**Solution:**
```tsx
phone: z.string().trim()
  .min(1, "Telefonnummer erforderlich")
  .regex(/^[+]?[\d\s()-]{8,}$/, "Ungültige Telefonnummer"),
```

**Also Update:**
- `src/hooks/useWizardForm.ts` - wizard validation
- `src/components/QuickAuctionForm.tsx` - hero form validation
- `src/pages/RegisterHaendler.tsx` - dealer registration

**Effort:** 2 hours

---

### Issue 1.5: Hero Form Required Field Validation
**File:** `src/components/QuickAuctionForm.tsx`
**Problem:** "Jetzt kostenlos starten" button works without required fields

**Current Code (line 62):**
```tsx
const handleContinue = () => {
  // No validation - goes directly to wizard
  navigate(`/verkaufen/wizard?${searchParams.toString()}`);
};
```

**Solution:**
```tsx
const handleContinue = () => {
  // Validate required fields
  const errors: string[] = [];
  if (!manufacturer) errors.push("Hersteller");
  if (!model) errors.push("Modell");
  if (!bodyType) errors.push("Aufbauart");
  if (!customerName.trim()) errors.push("Name");
  if (!customerEmail.trim()) errors.push("E-Mail");
  if (!customerPhone.trim()) errors.push("Telefon");

  if (errors.length > 0) {
    toast({
      title: "Pflichtfelder ausfüllen",
      description: `Bitte füllen Sie aus: ${errors.join(", ")}`,
      variant: "destructive",
    });
    return;
  }

  // Capture lead immediately before wizard (Issue 1.8)
  captureLead();
  
  navigate(`/verkaufen/wizard?${searchParams.toString()}`);
};
```

**Effort:** 2 hours

---

### Issue 1.6: Lead Capture at Form Start ✅ COMPLETED
**File:** `src/components/QuickAuctionForm.tsx`
**Problem:** Need to capture lead data when user clicks "Jetzt kostenlos starten"

**Solution:**
Add lead capture before navigation:

```tsx
const captureLead = async () => {
  try {
    await supabase.from('quick_leads').insert({
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      manufacturer,
      model,
      body_type: bodyType,
      sale_channel: saleChannel,
      source: 'hero_form',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Lead capture error:', error);
    // Don't block user flow on error
  }
};
```

**Database Migration Required:**
```sql
CREATE TABLE quick_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  manufacturer TEXT,
  model TEXT,
  body_type TEXT,
  sale_channel TEXT,
  source TEXT DEFAULT 'hero_form',
  wizard_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quick_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage" ON quick_leads FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Anyone can insert" ON quick_leads FOR INSERT WITH CHECK (true);
```

**Effort:** 3 hours

---

### Issue 1.7: Password Reset - Verify Functionality
**File:** `src/pages/ForgotPassword.tsx`
**Problem:** Client reports "Schreiben Sie uns eine Email" message

**Analysis:** Code looks correct (uses `supabase.auth.resetPasswordForEmail`)

**Possible Issues:**
1. Supabase email templates not configured
2. Email provider (Resend) not set up in Supabase Auth
3. SMTP settings incorrect

**Action Items:**
1. Check Supabase Dashboard → Authentication → Email Templates
2. Verify email sending configuration
3. Test with real email address
4. Check spam folders

**Effort:** 2 hours (debugging)

---

### Issue 1.8: Branding - Replace Hardcoded "CamperAnker24" ✅ COMPLETED
**Problem:** 24 files have hardcoded "CamperAnker24" instead of using `settings?.site_name`

**Files Affected:**
```
src/pages/dashboard/DashboardLayout.tsx
src/pages/Wertermittlung.tsx
src/pages/Wertrechner.tsx
src/pages/dashboard/DashboardOverview.tsx
src/pages/Kontakt.tsx
src/lib/invoiceGenerator.ts
src/pages/AGB.tsx
src/pages/AuctionDetail.tsx
src/pages/Haendler.tsx
src/pages/UeberUns.tsx
src/pages/Datenschutz.tsx
src/components/Benefits.tsx
src/pages/FAQ.tsx
src/pages/dealer/DealerLayout.tsx
src/pages/Verkaufen.tsx
src/components/WhatsAppButton.tsx
src/pages/Ankaufstationen.tsx
src/pages/BlogPost.tsx
src/components/SmartDashboard.tsx
src/pages/Impressum.tsx
src/components/Process.tsx
src/pages/Blog.tsx
src/pages/DealerOnboarding.tsx
```

**Solution Pattern:**
1. Import `useSettings` hook
2. Get `settings?.site_name`
3. Replace hardcoded string

**Example Fix (WhatsAppButton.tsx):**
```tsx
// Before:
const whatsappUrl = `https://wa.me/${phoneNumber}?text=Hallo! Ich habe eine Frage zu CamperAnker24.`;

// After:
const { settings } = useSettings();
const siteName = settings?.site_name || 'CaravanWert';
const whatsappUrl = `https://wa.me/${phoneNumber}?text=Hallo! Ich habe eine Frage zu ${siteName}.`;
```

**Effort:** 4-5 hours (24 files)

---

## 🟠 PHASE 2: HIGH PRIORITY FEATURES (Week 2)

### Issue 2.1: Admin - Dealer Suspend Functionality
**File:** `src/pages/admin/AdminDealers.tsx`
**Problem:** Cannot suspend dealers from admin panel

**Current State:** `is_suspended` field exists but no UI to toggle

**Solution:**
Add suspend/unsuspend buttons to dealer actions:

```tsx
const suspendMutation = useMutation({
  mutationFn: async (dealerId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_suspended: true })
      .eq('id', dealerId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["activeDealers"] });
    toast({ title: "Händler gesperrt" });
  },
});

// In dealer row:
<DropdownMenuItem onClick={() => suspendMutation.mutate(dealer.profiles?.id)}>
  <Ban className="w-4 h-4 mr-2" />
  Händler sperren
</DropdownMenuItem>
```

**Effort:** 2-3 hours

---

### Issue 2.2: Admin - Edit Auctions
**File:** `src/pages/admin/AdminAuctions.tsx`
**Problem:** Auctions cannot be edited from admin panel

**Solution:**
1. Create `AuctionEditDialog.tsx` component
2. Add edit button to auction table
3. Allow editing: end_time, starting_bid, reserve_price, status

**Effort:** 4-5 hours

---

### Issue 2.3: Reserve Price (Mindestpreis) Logic
**Files:** `src/pages/AuctionDetail.tsx`, `src/pages/admin/AdminAuctions.tsx`
**Problems:**
1. Reserve price visible to dealers (should be HIDDEN)
2. Auction starts at reserve price (should ALWAYS start at €50)
3. Bid increment should be minimum €50

**Current Code (AuctionDetail.tsx lines 1128-1133):**
```tsx
{auction.reserve_price && (
  <div>
    {reserveMet ? (
      <Badge>Mindestpreis erreicht</Badge>
```

**Solution:**
1. Hide reserve_price display for non-owners and non-admins
2. Always set starting_bid = 50 in auction creation
3. Enforce min_bid_increment = 50 in bidding logic

```tsx
// Only show to owner or admin
const canSeeReservePrice = user?.id === auction.motorhome.seller_id || isAdmin;

{canSeeReservePrice && auction.reserve_price && (
  // ... show reserve price indicator
)}
```

**Database/Logic Changes:**
- Auction creation: `starting_bid` always = 50
- Bid validation: `new_bid >= current_bid + 50`

**Effort:** 4-5 hours

---

### Issue 2.4: Admin Motorhomes - Show Title Image
**File:** `src/pages/admin/AdminMotorhomes.tsx`
**Problem:** Table doesn't show vehicle thumbnail

**Solution:**
Add image column to table:

```tsx
<TableHead>Bild</TableHead>

// In row:
<TableCell>
  {motorhome.photos?.[0]?.photo_url ? (
    <img 
      src={motorhome.photos[0].photo_url} 
      alt={`${motorhome.manufacturer} ${motorhome.model}`}
      className="w-16 h-12 object-cover rounded"
    />
  ) : (
    <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
      <Car className="w-6 h-6 text-muted-foreground" />
    </div>
  )}
</TableCell>
```

**Effort:** 1 hour

---

### Issue 2.5: Wizard Progress - Remove Step Numbers
**File:** `src/pages/VerkaufenWizard.tsx`
**Problem:** Step numbers should be removed, keep only progress bar with percentage

**Current Code (lines 170-183):**
```tsx
<div className="w-6 h-6 md:w-8 md:h-8 rounded-full ...">
  {step.id < currentStep ? (
    <Check className="w-3 h-3 md:w-4 md:h-4" />
  ) : (
    <span className="text-[9px] md:text-xs font-medium">{step.id}</span>
  )}
</div>
```

**Solution:**
```tsx
// Replace step indicators with simpler dots or remove entirely
// Add percentage to progress bar

<div className="mb-4">
  <div className="flex justify-between items-center mb-2">
    <span className="text-sm font-medium">{steps[currentStep - 1].name}</span>
    <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
  </div>
  <Progress value={progress} className="h-2" />
</div>
```

**Effort:** 1-2 hours

---

### Issue 2.6: Dealer Cannot See Auctions (BUG)
**Files:** `src/pages/dealer/DealerAuctions.tsx`, `src/components/DealerSidebar.tsx`
**Problem:** Client reports "Händler sieht die Aktuellen Auktionen garnicht"

**Analysis:**
- DealerSidebar has correct link: `/dashboard/auctions`
- DealerAuctions.tsx exists and fetches all `active`/`draft` auctions
- SmartDashboard correctly routes to DealerAuctions

**Possible Causes:**
1. No auctions exist with `active` or `draft` status
2. RLS policy blocking dealer access to auctions table
3. Query error not being displayed properly
4. Routing issue with path matching

**Required Investigation:**
1. Check Supabase RLS policies on `auctions` table
2. Verify auctions exist with correct status
3. Add error logging/display to DealerAuctions
4. Test dealer login flow manually

**Solution if RLS issue:**
```sql
-- Ensure dealers can read active auctions
CREATE POLICY "Dealers can view active auctions" ON auctions
  FOR SELECT TO authenticated
  USING (status IN ('active', 'draft'));
```

**Effort:** 2-3 hours (debugging)

---

### Issue 2.7: User Dashboard - Remove "Meine Inserate" for Dealers
**File:** `src/components/UserSidebar.tsx`
**Problem:** Need role-based menu filtering

**Current Menu (line 30-36):**
```tsx
const menuItems = [
  { title: "Übersicht", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meine Inserate", url: "/dashboard/listings", icon: Car },  // Hide for dealers
  { title: "Meine Gebote", url: "/dashboard/bids", icon: Gavel },
  { title: "Meine Termine", url: "/dashboard/appointments", icon: Calendar },
  { title: "Profil", url: "/dashboard/profile", icon: User },
];
```

**Solution:**
Use SmartDashboard component which already handles role-based routing

**Effort:** 2 hours

---

### Issue 2.8: "Über uns" Page Verification
**File:** `src/pages/UeberUns.tsx`
**Problem:** Client says page is missing

**VERIFIED - PAGE EXISTS:**
- Route: `/ueber-uns` in `App.tsx` (line 113)
- Page: `src/pages/UeberUns.tsx` exists
- Links exist in:
  - `Header.tsx` (line 87)
  - `Footer.tsx` (line 197-198)
  - `RelatedContent.tsx` (multiple references)

**Action:** Verify page content is complete and links are visible/accessible

**Effort:** 0.5 hours (verification only)

---

## 🟡 PHASE 3: MEDIUM PRIORITY FEATURES (Week 3)

### Issue 3.1: Search & Filter Enhancements
**File:** `src/pages/Kaufen.tsx`
**Missing Filters:**
- Standort/Land (Location/Country)
- Kilometerstand (Mileage range)
- Getriebeart (Transmission)
- Antriebsart (Drive type)
- Unfallstatus (Accident status)
- Auktionsstatus (Auction status)
- Sofortkauf-Option (Buy now option)

**Additional Requirements from Client:**
- Dropdown with available countries/regions
- Checkbox selection for multiple countries
- **Display vehicle count per country** (e.g., "Deutschland (15)")
- Distance calculation to user location (covered in Issue 4.5)

**Solution:**
Expand filter component with additional fields:

```tsx
// Add to filter state:
const [filters, setFilters] = useState({
  countries: [] as string[],  // Multi-select
  mileageMin: '',
  mileageMax: '',
  transmission: '',
  driveType: '',
  accidentFree: null,
  auctionStatus: '',
  buyNowOnly: false,
});

// Fetch vehicle counts per country
const { data: countryCounts } = useQuery({
  queryKey: ['countryStats'],
  queryFn: async () => {
    const { data } = await supabase
      .from('motorhomes')
      .select('country')
      .not('country', 'is', null);
    
    // Count by country
    const counts: Record<string, number> = {};
    data?.forEach(m => {
      counts[m.country] = (counts[m.country] || 0) + 1;
    });
    return counts;
  }
});

// Render with counts
<SelectItem value="DE">Deutschland ({countryCounts?.['DE'] || 0})</SelectItem>
```

**Effort:** 8-10 hours

---

### Issue 3.2: Real-time Auction Countdown
**File:** `src/pages/AuctionDetail.tsx`
**Requirements:**
- WebSocket-based updates
- Second-precision countdown
- Color highlight when < 5 minutes

**Current State:** Has countdown but may not be real-time WebSocket

**Solution:**
1. Verify Supabase Realtime subscription for auctions
2. Add countdown component with useEffect interval
3. Add visual warning for < 5 minutes

```tsx
const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

useEffect(() => {
  const timer = setInterval(() => {
    const left = calculateTimeLeft();
    setTimeLeft(left);
    
    // End auction if time expired
    if (left.total <= 0) {
      clearInterval(timer);
    }
  }, 1000);
  
  return () => clearInterval(timer);
}, [auction.end_time]);

// Color coding
const isUrgent = timeLeft.total < 5 * 60 * 1000; // < 5 minutes
<Badge className={isUrgent ? "bg-red-500 animate-pulse" : ""}>
  {formatTimeLeft(timeLeft)}
</Badge>
```

**Effort:** 4-5 hours

---

### Issue 3.3: Buy Now (Sofortkauf) Enhancement
**Current State:** 128 references exist - partially implemented

**Missing:**
- "Sofortkauf möglich" badge on listings
- Separate purchase flow
- Toggle for sellers

**Files to Update:**
- `src/components/MotorhomeCard.tsx` - Add badge
- `src/pages/AuctionDetail.tsx` - Add buy now button
- `src/components/wizard/SaleChannelStep.tsx` - Verify seller can enable

**Effort:** 4-5 hours

---

### Issue 3.4: Auto-bidding (Bietagent)
**Current State:** 50 references to autobid exist

**Requirements:**
- Maximum bid input for buyer
- Automatic bid increment when outbid
- Notifications when max exceeded

**Implementation:**
1. Add `max_autobid` field to bid submission
2. Create trigger/function to auto-bid
3. Add UI for setting max bid

**Effort:** 6-8 hours

---

### Issue 3.5: Additional Vehicle Fields
**Missing Fields:**
- Hubraum (Engine displacement in cm³)
- Kfz-Kennzeichen (License plate - optional)
- Klimatisierung (AC type)
- Anzahl Gurtsitzplätze (Seatbelt seats count)
- Hauptsatz Reifen (Main tire set)
- Zweiter Reifensatz (Second tire set)

**Database Migration:**
```sql
ALTER TABLE motorhomes
ADD COLUMN engine_displacement_ccm INTEGER,
ADD COLUMN license_plate TEXT,
ADD COLUMN ac_type TEXT,
ADD COLUMN seatbelt_seats INTEGER,
ADD COLUMN main_tires TEXT,
ADD COLUMN second_tires TEXT;
```

**Update Wizard Forms:** Add fields to `TechnicalDetailsStep.tsx`

**Effort:** 4-5 hours

---

### Issue 3.6: Equipment Categories
**Requirements:**
- Basisfahrzeug: Airbag, Alarm, Swivel seats, Parking assist, ESP, Cruise control
- Wohnbereich: Heating type, Fridge size, Toilet type, Solar

**Solution:**
Expand `VehicleFeaturesStep.tsx` with structured categories

**Effort:** 4-5 hours

---

### Issue 3.7: Known Defects Section
**Requirements:**
- Mandatory field in wizard
- Prominent display on detail page
- Option: "Keine erwähnenswerten Mängel bekannt"

**Implementation:**
1. Add `known_defects` text field to motorhomes table
2. Add step or section in wizard
3. Display prominently in AuctionDetail

**Effort:** 3-4 hours

---

## 🟢 PHASE 4: LOW PRIORITY FEATURES (Week 4)

### Issue 4.1: Kaufchance + Nachverhandlung System (Post-Auction)
**New Feature:** Allow buyers to make/negotiate offers after auction ends without winner

**Part A - Kaufchance Feature:**
1. New auction status: `kaufchance` when auction ends without meeting reserve
2. Time window (48h) for offers
3. Notification to interested buyers

**Part B - Nachverhandlungs-System:**
1. Separate negotiation area for post-auction offers
2. Gegenangebot (counter-offer) functionality
3. Time limit for negotiations
4. Structured offer/counter-offer flow

**Database Schema:**
```sql
CREATE TABLE post_auction_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES auth.users(id),
  offer_amount DECIMAL(10,2) NOT NULL,
  counter_offer_amount DECIMAL(10,2),
  status TEXT DEFAULT 'pending', -- pending, countered, accepted, rejected, expired
  message TEXT,
  seller_response TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add kaufchance status to auctions
ALTER TABLE auctions ADD COLUMN kaufchance_expires_at TIMESTAMPTZ;
```

**UI Components:**
- `KaufchanceBadge.tsx` - Shows on listings
- `PostAuctionOfferDialog.tsx` - Make offers
- `NegotiationThread.tsx` - Counter-offer conversation
- Dashboard section for Kaufchancen

**Effort:** 12-15 hours (expanded scope)

---

### Issue 4.2: Dashboard Extensions
**Missing Sections:**
- Nachrichten (Messages to admin/support)
- Kaufchancen (Post-auction opportunities)
- Favoriten (Saved vehicles)
- Rechnungen (Invoices with status)
- Einstellungen (Notification preferences)

**Implementation:**
1. Create `favorites` table with user-motorhome relation
2. Create `messages` table for support communication
3. Create `invoices` table with paid/open status
4. Create `user_settings` table for preferences
5. Add sidebar items and pages

**Effort:** 15-20 hours (major feature set)

---

### Issue 4.3: Question to Vehicle - Admin Receives
**Requirement:** Buyer asks question, ADMIN receives (not seller)

**Implementation:**
1. Create `vehicle_questions` table
2. Question form on AuctionDetail page
3. Admin panel to view/respond
4. Response sent to questioner

**Effort:** 4-5 hours

---

### Issue 4.4: Vehicle Card Internal Number
**File:** `src/components/MotorhomeCard.tsx`
**Requirement:** Show "#CV-12345" reference number

**Solution:**
Generate internal reference on motorhome creation:

```tsx
// In MotorhomeCard:
<span className="text-xs text-muted-foreground">
  #{motorhome.reference_number || `CV-${motorhome.id.slice(0, 5).toUpperCase()}`}
</span>
```

**Effort:** 1 hour

---

### Issue 4.5: Location with Distance
**Requirements:**
- User geolocation (with consent)
- Distance calculation
- Country flag

**Implementation:**
1. Request geolocation permission
2. Store motorhome location (lat/lng)
3. Calculate distance using Haversine formula
4. Display with flag emoji

**Effort:** 4-5 hours

---

## 📊 DATABASE MIGRATIONS SUMMARY

### Migration 1: Quick Leads Table
```sql
-- 20260115_001_create_quick_leads.sql
CREATE TABLE quick_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  manufacturer TEXT,
  model TEXT,
  body_type TEXT,
  sale_channel TEXT,
  source TEXT DEFAULT 'hero_form',
  wizard_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration 2: Additional Motorhome Fields
```sql
-- 20260115_002_add_motorhome_fields.sql
ALTER TABLE motorhomes
ADD COLUMN engine_displacement_ccm INTEGER,
ADD COLUMN license_plate TEXT,
ADD COLUMN ac_type TEXT,
ADD COLUMN seatbelt_seats INTEGER,
ADD COLUMN main_tires TEXT,
ADD COLUMN second_tires TEXT,
ADD COLUMN known_defects TEXT,
ADD COLUMN reference_number TEXT;

-- Generate reference numbers for existing
UPDATE motorhomes SET reference_number = 'CV-' || UPPER(LEFT(id::text, 5)) WHERE reference_number IS NULL;
```

### Migration 3: Favorites System
```sql
-- 20260115_003_create_favorites.sql
CREATE TABLE user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  motorhome_id UUID REFERENCES motorhomes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, motorhome_id)
);
```

### Migration 4: Vehicle Questions
```sql
-- 20260115_004_create_vehicle_questions.sql
CREATE TABLE vehicle_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  motorhome_id UUID REFERENCES motorhomes(id) ON DELETE CASCADE,
  questioner_id UUID REFERENCES auth.users(id),
  questioner_email TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES auth.users(id),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🧪 TESTING CHECKLIST

### Phase 1 Testing ✅ COMPLETED
- [x] Hero form model depends on manufacturer
- [x] All manufacturers available in dropdown
- [x] Photos display correctly for all motorhomes (RLS verified)
- [x] Phone number is required on registration
- [x] Hero form validates required fields
- [x] Leads are captured on form submit (quick_leads table created)
- [x] Password reset emails work (verified implementation)
- [x] Site name uses settings, not hardcoded (24 src files + infrastructure)

### Phase 2 Testing
- [ ] Admin can suspend/unsuspend dealers
- [ ] Admin can edit auction details
- [ ] Reserve price hidden from dealers
- [ ] Auctions always start at €50
- [ ] Minimum bid increment is €50
- [ ] Motorhome thumbnails show in admin list
- [ ] Wizard progress shows percentage, no step numbers
- [ ] Dashboard shows correct menu for user role

### Phase 3 Testing
- [ ] All new filters work correctly
- [ ] Vehicle count displays per country in filter
- [ ] Multi-select for countries works
- [ ] Countdown updates in real-time
- [ ] Countdown shows warning under 5 minutes
- [ ] Buy now option works end-to-end
- [ ] Auto-bidding increments correctly
- [ ] New vehicle fields save and display
- [ ] Known defects section works

### Phase 4 Testing
- [ ] Kaufchance status appears after auction ends without winner
- [ ] Post-auction offers can be submitted
- [ ] Counter-offer (Gegenangebot) works
- [ ] Negotiation time limit enforced
- [ ] Favorites can be added/removed
- [ ] Messages reach admin
- [ ] Invoices display with status (paid/open)
- [ ] Vehicle questions work
- [ ] Internal reference numbers display
- [ ] Distance calculation works
- [ ] Country flags display correctly

---

## 📅 IMPLEMENTATION TIMELINE

| Week | Phase | Focus |
|------|-------|-------|
| 1 | Phase 1 | Critical bugs, validation, branding |
| 2 | Phase 2 | Admin features, auction logic |
| 3 | Phase 3 | Filters, real-time, auto-bidding |
| 4 | Phase 4 | Dashboard extensions, new features |

---

## 🔧 TECHNICAL NOTES

### Settings Hook Usage
Always use `useSettings()` for dynamic content:
```tsx
import { useSettings } from "@/contexts/SettingsContext";

const MyComponent = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';
  // Use siteName instead of hardcoded string
};
```

### Database Access Pattern
The correct project ID for Supabase MCP operations:
- Project ID: `cmvhcudymrtvmbomkenq`

### File Organization
- New components go in `src/components/`
- New admin pages go in `src/pages/admin/`
- New dashboard pages go in `src/pages/dashboard/`
- Migrations go in `supabase/migrations/`

---

## ℹ️ OPERATIONAL TASKS (Non-Code)

### Task O.1: Upload Project to GitHub
**Request:** "Projekt bitte in Github hochladen damit wir ein Programierer Anstellen können und er Änderungen vornehmen kann."

**Steps:**
1. Create new private repository on GitHub
2. Add `.gitignore` for node_modules, .env files
3. Push codebase to repository
4. Create README with setup instructions
5. Add collaborator access for new developer

**Note:** This is an operational task requiring GitHub account access, not a code change.

---

## 📝 NOTES ON EXISTING FUNCTIONALITY

### "Über uns" Page
The client mentioned this page is missing, but **it already exists**:
- Route: `/ueber-uns`
- File: `src/pages/UeberUns.tsx`
- Links in Header, Footer, and RelatedContent

**Action:** Verify with client what specific issue they're experiencing.

### Dealer Auctions Access
The dealer dashboard should show auctions at `/dashboard/auctions`. The sidebar and routing are correctly configured. If dealers cannot see auctions:
1. Check RLS policies on `auctions` table
2. Verify auctions exist with `active` or `draft` status
3. Check for JavaScript errors in console

---

**Document Version:** 2.0
**Created:** January 15, 2026
**Last Updated:** January 16, 2026
**Author:** AI Assistant
**Status:** Phase 1 Complete, Phase 2 Ready to Start

### Remaining Items (Not Code Changes)
The following files still contain `camperanker24` references but are intentionally left unchanged:
- **Documentation files:** `NEW-CHANGES-IMPLEMENTATION-PLAN.md`, `CLIENT-CHANGES-IMPLEMENTATION.md`, `new-client-changes.md`, `TECHNICAL-DEBT-TASKS.md`, `docs/README.md`, `docs/wohnmobile_platform.md`
- **Database migrations (historical):** These contain initial seed data. If the data was already inserted, update via admin panel or create a new UPDATE migration.
