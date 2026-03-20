# Client Changes Implementation Plan

## CamperAnker24 / Wohnmobil24 - Feature Requests & Bug Fixes

**Created:** January 14, 2026  
**Client Feedback Date:** January 2026  
**Total Estimated Effort:** ~66 hours  
**Priority:** Production-blocking issues

---

## 📊 Executive Summary

| Priority | Issues | Effort |
|----------|--------|--------|
| 🔴 Critical | #1/#2, #5, #8, #13 | 18.5h |
| 🟠 High | #6, #7, #10 | 17h |
| 🟡 Medium | #9, #11 | 20h |
| 🟢 Low | #3, #4, #12 | 3.5h |
| **Total** | **13 Issues** | **~66 hours** |

---

## 📋 Issue Overview

| # | Issue (German) | Issue (English) | Status | Priority |
|---|----------------|-----------------|--------|----------|
| 1 | Admin kann Inserate nicht verwalten | Admin cannot manage listings | ❌ Missing | 🔴 Critical |
| 2 | Wohnmobile Navigation - keine Aktionen | Motorhomes admin - no actions | ❌ Missing | 🔴 Critical |
| 3 | WhatsApp-Nummer nicht änderbar | WhatsApp number not changeable | ⚠️ UI Issue | 🟢 Low |
| 4 | Admin Logo nicht klickbar | Admin logo not clickable | ❌ Bug | 🟢 Low |
| 5 | Registrierung vor Inserateingabe | Registration before listing input | ❌ Wrong Flow | 🔴 Critical |
| 6 | Händler-Anmeldung: Fehlende Felder | Dealer registration: Missing fields | ❌ Incomplete | 🟠 High |
| 7 | Händler erhält keine Genehmigungsbenachrichtigung | Dealer gets no approval notification | ❌ Missing | 🟠 High |
| 8 | Passwort vergessen fehlt | Forgot password missing | ❌ Missing | 🔴 Critical |
| 9 | Wertermittlung/Wertrechner Landingpages | Value assessment landing pages | ❌ Missing | 🟡 Medium |
| 10 | Admin kann Kunden/Händler nicht bearbeiten | Admin cannot edit users/dealers | ❌ Missing | 🟠 High |
| 11 | AGB erweiterbar + im Admin bearbeitbar | AGB editable in admin panel | ❌ Missing | 🟡 Medium |
| 12 | AGB als Popup statt Seite | AGB as popup instead of page | ❌ Missing | 🟢 Low |
| 13 | Privatnutzer wird zur Startseite weitergeleitet | Private user redirected to homepage | ⚠️ Bug | 🔴 Critical |

---

## 🚀 Implementation Phases

### Phase 1: Critical Bugs & Core Functionality (Week 1)
**Priority:** 🔴 Critical  
**Effort:** ~18.5 hours

### Phase 2: High Priority Features (Week 2)
**Priority:** 🟠 High  
**Effort:** ~17 hours

### Phase 3: Medium Priority Features (Week 3)
**Priority:** 🟡 Medium  
**Effort:** ~20 hours

### Phase 4: Low Priority & Polish (Week 4)
**Priority:** 🟢 Low  
**Effort:** ~3.5 hours

---

## 📝 Phase 1: Critical Bugs & Core Functionality

### Issue #1 & #2: Admin Motorhome Management
**File:** `src/pages/admin/AdminMotorhomes.tsx`  
**Effort:** 8 hours  
**Priority:** 🔴 Critical

**Current State:**
- Table displays motorhomes but Eye button is non-functional
- No edit, delete, or status management capabilities

**Implementation Tasks:**

- [ ] **Task 1.1:** Create `MotorhomeDetailDialog` component
  - Display all motorhome details in a dialog
  - Show photo gallery with lightbox
  - Show seller contact information
  - Show auction/sale status

- [ ] **Task 1.2:** Create `MotorhomeEditDialog` component
  - Edit all motorhome fields
  - Update photos (add/remove)
  - Change sale channel
  - Update pricing

- [ ] **Task 1.3:** Add status management
  - Approve pending listings
  - Reject with reason
  - Suspend active listings
  - Reactivate suspended listings

- [ ] **Task 1.4:** Add delete functionality
  - Confirmation dialog
  - Cascade delete photos from storage
  - Handle related auctions/bids

- [ ] **Task 1.5:** Add action dropdown menu
  - View details
  - Edit
  - Change status
  - Create auction
  - Contact seller
  - Delete

**Code Changes:**

```typescript
// AdminMotorhomes.tsx - Add imports
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Trash2, CheckCircle, XCircle, Gavel } from "lucide-react";

// Replace Eye button with action menu
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <MoreHorizontal className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleViewDetails(motorhome)}>
      <Eye className="w-4 h-4 mr-2" /> Details anzeigen
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleEdit(motorhome)}>
      <Edit className="w-4 h-4 mr-2" /> Bearbeiten
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => handleCreateAuction(motorhome)}>
      <Gavel className="w-4 h-4 mr-2" /> Auktion erstellen
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem 
      onClick={() => handleDelete(motorhome)}
      className="text-destructive"
    >
      <Trash2 className="w-4 h-4 mr-2" /> Löschen
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### Issue #5: Registration After Listing Input
**Files:** `src/App.tsx`, `src/pages/VerkaufenWizard.tsx`, `src/hooks/useWizardForm.ts`  
**Effort:** 12 hours  
**Priority:** 🔴 Critical

**Current Flow:**
1. User clicks "Verkaufen"
2. Redirected to login (ProtectedRoute)
3. Must register/login first
4. Then can access wizard

**Desired Flow:**
1. User clicks "Verkaufen"
2. Completes entire wizard
3. At final step, prompted to register/login
4. After auth, listing is submitted

**Implementation Tasks:**

- [ ] **Task 5.1:** Remove ProtectedRoute from VerkaufenWizard route
  ```typescript
  // App.tsx - Change from:
  <Route path="/verkaufen/wizard" element={
    <ProtectedRoute>
      <VerkaufenWizard />
    </ProtectedRoute>
  } />
  
  // To:
  <Route path="/verkaufen/wizard" element={
    <FormErrorBoundary>
      <VerkaufenWizard />
    </FormErrorBoundary>
  } />
  ```

- [ ] **Task 5.2:** Add localStorage persistence for form data
  ```typescript
  // useWizardForm.ts
  const STORAGE_KEY = 'verkaufen_wizard_draft';
  
  // Save to localStorage on every update
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);
  
  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setFormData(JSON.parse(saved));
    }
  }, []);
  ```

- [ ] **Task 5.3:** Create `AuthenticationStep` component
  - New wizard step before final submission
  - Shows login/register forms inline
  - Option to continue as guest (email only)
  - Validates user is authenticated before submit

- [ ] **Task 5.4:** Update `submitForm` function
  - Check if user is authenticated
  - If not, show auth step
  - After successful auth, submit listing
  - Clear localStorage after successful submission

- [ ] **Task 5.5:** Handle photo uploads for unauthenticated users
  - Store photos in temporary storage bucket
  - Move to permanent bucket after auth
  - Clean up orphaned temp files (cron job)

---

### Issue #8: Forgot Password Functionality
**Files:** New files + `src/pages/Login.tsx`, `src/pages/LoginHaendler.tsx`  
**Effort:** 4 hours  
**Priority:** 🔴 Critical

**Implementation Tasks:**

- [ ] **Task 8.1:** Create `src/pages/ForgotPassword.tsx`
  ```typescript
  // Form with email input
  // Calls supabase.auth.resetPasswordForEmail(email)
  // Shows success message with instructions
  ```

- [ ] **Task 8.2:** Create `src/pages/ResetPassword.tsx`
  ```typescript
  // Password reset form (new password + confirm)
  // Validates token from URL
  // Calls supabase.auth.updateUser({ password })
  ```

- [ ] **Task 8.3:** Add routes to App.tsx
  ```typescript
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  ```

- [ ] **Task 8.4:** Add "Passwort vergessen?" link to login pages
  ```typescript
  // Login.tsx & LoginHaendler.tsx
  <Link to="/forgot-password" className="text-sm text-primary hover:underline">
    Passwort vergessen?
  </Link>
  ```

- [ ] **Task 8.5:** Configure Supabase email templates
  - Update password reset email template in Supabase dashboard
  - German language email content
  - Branded styling

---

### Issue #13: Private User Redirect Bug
**File:** `src/components/ProtectedRoute.tsx`, `src/pages/VerkaufenWizard.tsx`  
**Effort:** 2 hours  
**Priority:** 🔴 Critical

**Investigation Tasks:**

- [ ] **Task 13.1:** Debug ProtectedRoute behavior
  - Add logging to identify redirect cause
  - Check if dealer role check is causing issues
  - Verify loading state handling

- [ ] **Task 13.2:** Check VerkaufenWizard for redirects
  - Search for `navigate("/")` calls
  - Check useEffect hooks for redirect logic
  - Verify role-based access isn't blocking

- [ ] **Task 13.3:** Fix identified issue
  - Update redirect logic
  - Add proper role checks
  - Test with different user types

---

## 📝 Phase 2: High Priority Features

### Issue #6: Dealer Registration - Missing Fields & Document Error
**File:** `src/pages/DealerRegister.tsx`  
**Effort:** 4 hours  
**Priority:** 🟠 High

**Missing Fields to Add:**

| Field | Type | Validation |
|-------|------|------------|
| Rechtsform | Select | GmbH, UG, AG, Einzelunternehmen, GbR |
| Gründungsjahr | Number | Year business was established |
| Handelsregisternummer | Text | Optional, required for GmbH/AG |
| Anzahl Mitarbeiter | Select | 1-5, 6-20, 21-50, 50+ |
| Jahresumsatz (ca.) | Select | Range brackets |
| IBAN | Text | German IBAN validation |
| BIC | Text | BIC/SWIFT validation |

**Implementation Tasks:**

- [ ] **Task 6.1:** Add new form fields to schema
  ```typescript
  const dealerApplicationSchema = z.object({
    // ... existing fields
    legalForm: z.enum(['einzelunternehmen', 'gbr', 'ug', 'gmbh', 'ag']),
    foundedYear: z.number().min(1900).max(new Date().getFullYear()),
    handelsregisterNumber: z.string().optional(),
    employeeCount: z.enum(['1-5', '6-20', '21-50', '50+']),
    annualRevenue: z.enum(['<100k', '100k-500k', '500k-1m', '1m-5m', '>5m']).optional(),
    iban: z.string().regex(/^DE\d{20}$/, "Ungültige IBAN"),
    bic: z.string().min(8).max(11),
  });
  ```

- [ ] **Task 6.2:** Add form UI components for new fields

- [ ] **Task 6.3:** Update database schema
  - Add columns to `dealer_applications` table
  - Create migration file

- [ ] **Task 6.4:** Debug document upload error
  - Check Supabase Storage bucket permissions
  - Verify file size limits
  - Add better error messages
  - Test with different file types

---

### Issue #7: Dealer Approval Notification
**Files:** `src/pages/admin/AdminDealers.tsx`, new Edge Function  
**Effort:** 3 hours  
**Priority:** 🟠 High

**Implementation Tasks:**

- [ ] **Task 7.1:** Create Edge Function `send-dealer-approval-notification`
  ```typescript
  // supabase/functions/send-dealer-approval-notification/index.ts
  // Sends email to dealer with:
  // - Approval confirmation
  // - Login instructions
  // - Next steps
  // - Welcome message
  ```

- [ ] **Task 7.2:** Update `approveMutation` in AdminDealers.tsx
  ```typescript
  const approveMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      // 1. Approve application
      await approveDealerApplication(applicationId);
      
      // 2. Send notification email
      await supabase.functions.invoke('send-dealer-approval-notification', {
        body: { applicationId }
      });
    },
    // ... rest of mutation
  });
  ```

- [ ] **Task 7.3:** Create email template for approval
  - German language
  - Include login link
  - Include support contact
  - Branded design

---

### Issue #10: Admin User/Dealer Management
**Files:** `src/pages/admin/AdminUsers.tsx`, `src/pages/admin/AdminDealers.tsx`  
**Effort:** 10 hours  
**Priority:** 🟠 High

**Implementation Tasks for AdminUsers.tsx:**

- [ ] **Task 10.1:** Create `UserEditDialog` component
  - Edit first name, last name, phone
  - Change email (with verification)
  - Manage roles (add/remove)
  - Account status (active/suspended)

- [ ] **Task 10.2:** Add user actions dropdown
  - View profile
  - Edit user
  - Change roles
  - Suspend/Activate
  - Delete user

- [ ] **Task 10.3:** Add user filtering/search
  - Search by name/email
  - Filter by role
  - Filter by status

**Implementation Tasks for AdminDealers.tsx:**

- [ ] **Task 10.4:** Add "Active Dealers" tab/section
  - List all approved dealers
  - Show company info, contact, status

- [ ] **Task 10.5:** Create `DealerEditDialog` component
  - Edit company information
  - Update contact details
  - Manage documents
  - View payment history

- [ ] **Task 10.6:** Add dealer actions
  - View full profile
  - Edit details
  - Suspend/Reactivate
  - View activity history

---

## 📝 Phase 3: Medium Priority Features

### Issue #9: Value Assessment Landing Pages
**Files:** New pages, new database table  
**Effort:** 12 hours  
**Priority:** 🟡 Medium

**Implementation Tasks:**

- [ ] **Task 9.1:** Create database table for leads
  ```sql
  CREATE TABLE value_assessment_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    manufacturer TEXT,
    model TEXT,
    year INTEGER,
    mileage INTEGER,
    condition TEXT,
    message TEXT,
    source TEXT, -- 'wertermittlung' or 'wertrechner'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    contacted_at TIMESTAMPTZ,
    status TEXT DEFAULT 'new'
  );
  ```

- [ ] **Task 9.2:** Create `src/pages/Wertermittlung.tsx`
  - Hero section with value proposition
  - Lead capture form
  - Trust signals
  - FAQ section
  - SEO optimized

- [ ] **Task 9.3:** Create `src/pages/Wertrechner.tsx`
  - Interactive calculator
  - Step-by-step value estimation
  - Lead capture at end
  - Email results option

- [ ] **Task 9.4:** Create `WertrechnerCalculator` component
  - Select manufacturer/model
  - Enter year, mileage
  - Select condition
  - Show estimated range
  - CTA to get exact value

- [ ] **Task 9.5:** Add routes to App.tsx
  ```typescript
  <Route path="/wertermittlung" element={<Wertermittlung />} />
  <Route path="/wertrechner" element={<Wertrechner />} />
  ```

- [ ] **Task 9.6:** Create Edge Function for lead notifications
  - Email admin when new lead comes in
  - Auto-response to user

- [ ] **Task 9.7:** Add to navigation
  - Header dropdown or link
  - Footer links
  - Internal linking from Verkaufen page

---

### Issue #11: Editable Legal Pages in Admin
**Files:** New admin page, database changes  
**Effort:** 8 hours  
**Priority:** 🟡 Medium

**Implementation Tasks:**

- [ ] **Task 11.1:** Update `legal_documents` table (or create if missing)
  ```sql
  CREATE TABLE legal_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL, -- 'agb', 'datenschutz', 'impressum'
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- HTML content
    version INTEGER DEFAULT 1,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Insert defaults
  INSERT INTO legal_documents (slug, title, content) VALUES
  ('agb', 'Allgemeine Geschäftsbedingungen', '<h2>§1...</h2>'),
  ('datenschutz', 'Datenschutzerklärung', '<h2>...</h2>'),
  ('impressum', 'Impressum', '<p>...</p>');
  ```

- [ ] **Task 11.2:** Create `src/pages/admin/AdminLegal.tsx`
  - List all legal documents
  - WYSIWYG editor (TipTap or similar)
  - Version history
  - Publish/Draft status

- [ ] **Task 11.3:** Add to admin sidebar
  ```typescript
  { title: "Rechtliches", url: "/admin/legal", icon: Scale },
  ```

- [ ] **Task 11.4:** Update AGB.tsx, Datenschutz.tsx, Impressum.tsx
  - Fetch content from database
  - Render HTML safely with DOMPurify
  - Fallback to static content if DB fails

- [ ] **Task 11.5:** Add specific AGB clause
  ```text
  § X Provision bei nicht angegebenen Mängeln
  
  Verweigert der Händler den Kauf des Wohnmobils aufgrund von:
  a) nicht angegebenen Schäden oder Mängeln, oder
  b) erheblichen Abweichungen zwischen Beschreibung und tatsächlichem Zustand,
  
  so ist der Verkäufer verpflichtet, die vereinbarte Provision an CamperAnker24 
  zu entrichten. Dies gilt auch wenn kein Kaufvertrag zustande kommt.
  ```

---

## 📝 Phase 4: Low Priority & Polish

### Issue #3: WhatsApp Number Configuration
**File:** `src/pages/admin/AdminSettings.tsx`  
**Effort:** 1 hour  
**Priority:** 🟢 Low

**Implementation Tasks:**

- [ ] **Task 3.1:** Add dedicated WhatsApp field
  ```typescript
  <div className="space-y-2">
    <Label htmlFor="whatsapp-number">WhatsApp Nummer</Label>
    <Input
      id="whatsapp-number"
      type="tel"
      value={formData.whatsapp_number || formData.support_phone || ''}
      onChange={(e) => updateField('whatsapp_number', e.target.value)}
      placeholder="+49 170 1234567"
    />
    <p className="text-xs text-muted-foreground">
      Nummer für den WhatsApp-Support-Button
    </p>
  </div>
  ```

- [ ] **Task 3.2:** Update WhatsAppButton.tsx
  ```typescript
  const phoneNumber = settings?.whatsapp_number || settings?.support_phone || '491234567890';
  ```

- [ ] **Task 3.3:** Add column to site_settings table
  ```sql
  ALTER TABLE site_settings ADD COLUMN whatsapp_number TEXT;
  ```

---

### Issue #4: Admin Logo Clickable
**File:** `src/components/AdminSidebar.tsx`  
**Effort:** 0.5 hours  
**Priority:** 🟢 Low

**Implementation Tasks:**

- [ ] **Task 4.1:** Wrap logo in Link component
  ```typescript
  // Change from:
  <img src="/logo.png" alt="..." className="h-10 w-auto mb-2" />
  
  // To:
  <Link to="/" className="block hover:opacity-80 transition-opacity">
    <img src="/logo.png" alt="..." className="h-10 w-auto mb-2" />
  </Link>
  ```

---

### Issue #12: AGB as Popup Dialog
**Files:** New component, update usage locations  
**Effort:** 2 hours  
**Priority:** 🟢 Low

**Implementation Tasks:**

- [ ] **Task 12.1:** Create `AGBDialog` component
  ```typescript
  // src/components/AGBDialog.tsx
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
  import { ScrollArea } from "@/components/ui/scroll-area";
  
  export const AGBDialog = ({ children }: { children: React.ReactNode }) => {
    const [content, setContent] = useState<string>('');
    
    // Fetch AGB content from database or static
    
    return (
      <Dialog>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Allgemeine Geschäftsbedingungen</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div 
              className="prose prose-sm"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };
  ```

- [ ] **Task 12.2:** Update AGB links in forms
  ```typescript
  // In registration forms, change:
  <Link to="/agb">AGB</Link>
  
  // To:
  <AGBDialog>
    <button className="text-primary underline">AGB</button>
  </AGBDialog>
  ```

- [ ] **Task 12.3:** Keep AGB page for SEO/direct access

---

## 🗃️ Database Migrations Required

### Migration 1: Dealer Application Fields
```sql
-- 20260115_add_dealer_application_fields.sql
ALTER TABLE dealer_applications 
ADD COLUMN legal_form TEXT,
ADD COLUMN founded_year INTEGER,
ADD COLUMN handelsregister_number TEXT,
ADD COLUMN employee_count TEXT,
ADD COLUMN annual_revenue TEXT,
ADD COLUMN iban TEXT,
ADD COLUMN bic TEXT;
```

### Migration 2: Value Assessment Leads
```sql
-- 20260115_create_value_assessment_leads.sql
CREATE TABLE value_assessment_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  manufacturer TEXT,
  model TEXT,
  year INTEGER,
  mileage INTEGER,
  condition TEXT,
  message TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'new'
);

ALTER TABLE value_assessment_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leads"
  ON value_assessment_leads FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Migration 3: Legal Documents
```sql
-- 20260115_create_legal_documents.sql
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

-- Public can read published documents
CREATE POLICY "Public can read published legal docs"
  ON legal_documents FOR SELECT
  USING (is_published = true);

-- Admins can manage all documents
CREATE POLICY "Admins can manage legal docs"
  ON legal_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Migration 4: WhatsApp Number Setting
```sql
-- 20260115_add_whatsapp_setting.sql
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
```

---

## 🧪 Testing Checklist

### Phase 1 Testing
- [ ] Admin can view, edit, delete motorhomes
- [ ] Admin can change motorhome status
- [ ] User can complete wizard without login
- [ ] User can register at end of wizard
- [ ] Listing is submitted after registration
- [ ] Form data persists in localStorage
- [ ] Forgot password email is sent
- [ ] Password reset works correctly
- [ ] Private user can access wizard when logged in

### Phase 2 Testing
- [ ] All new dealer fields validate correctly
- [ ] Document upload works with various file types
- [ ] Dealer receives approval email
- [ ] Admin can edit user profiles
- [ ] Admin can change user roles
- [ ] Admin can suspend/activate users
- [ ] Admin can edit dealer information

### Phase 3 Testing
- [ ] Wertermittlung page loads correctly
- [ ] Lead form submits successfully
- [ ] Admin receives lead notification
- [ ] Wertrechner calculator works
- [ ] Legal documents editable in admin
- [ ] Legal pages load from database
- [ ] AGB clause is present

### Phase 4 Testing
- [ ] WhatsApp button uses correct number
- [ ] Admin logo redirects to homepage
- [ ] AGB dialog opens and closes correctly
- [ ] AGB content displays properly in dialog

---

## 📅 Implementation Timeline

| Week | Phase | Focus |
|------|-------|-------|
| 1 | Phase 1 | Critical bugs, core functionality |
| 2 | Phase 2 | High priority features |
| 3 | Phase 3 | Medium priority features |
| 4 | Phase 4 | Low priority, testing, polish |

---

## 📊 Progress Tracking

### Phase 1: Critical ⏳
- [ ] Issue #1/#2: Admin motorhome management
- [ ] Issue #5: Registration after listing
- [ ] Issue #8: Forgot password
- [ ] Issue #13: Private user redirect bug

### Phase 2: High ⏳
- [ ] Issue #6: Dealer registration fields
- [ ] Issue #7: Dealer approval notification
- [ ] Issue #10: Admin user/dealer management

### Phase 3: Medium ⏳
- [ ] Issue #9: Value assessment pages
- [ ] Issue #11: Editable legal pages

### Phase 4: Low ⏳
- [ ] Issue #3: WhatsApp number config
- [ ] Issue #4: Admin logo clickable
- [ ] Issue #12: AGB popup dialog

---

**Document Version:** 1.0  
**Last Updated:** January 14, 2026  
**Next Review:** After Phase 1 completion
