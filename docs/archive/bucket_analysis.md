# Bucket-Analyse: Public vs Private

## Private Buckets (public: false) - getPublicUrl funktioniert NICHT:
1. **dealer-documents** - Händler-Dokumente (Gewerbenachweis, Ausweis, etc.)
2. **invoices** - Rechnungen
3. **purchase-contracts** - Kaufverträge

## Public Buckets (public: true) - getPublicUrl funktioniert:
1. **motorhome-photos** - Wohnmobil-Fotos
2. **branding** - Logo etc.

## Betroffene Stellen wo getPublicUrl auf private Buckets verwendet wird:
1. DealerRegister.tsx:173 - dealer-documents → getPublicUrl (BUG!)
2. LegalDocumentUpload.tsx:135 - dealer-documents → getPublicUrl (BUG!)
3. invoiceGenerator.ts:135 - invoices → getPublicUrl (BUG!)

## Stellen wo getPublicUrl korrekt auf public Buckets verwendet wird:
1. useWizardForm.ts:403 - motorhome-photos → OK
2. ListingEdit.tsx:360 - motorhome-photos → OK
3. AdminBlog.tsx:148 - branding → OK
4. AdminSettings.tsx:49 - branding → OK
5. RichTextEditor.tsx:76 - ? (muss geprüft werden)
6. DamageDocumentation.tsx:118 - ? (muss geprüft werden)

## Lösung:
Für private Buckets: createSignedUrl() statt getPublicUrl() verwenden
Oder: Beim Anzeigen im Admin-Bereich on-the-fly signierte URLs generieren
