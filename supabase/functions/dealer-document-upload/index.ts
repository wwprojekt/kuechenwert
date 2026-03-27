/**
 * Edge Function: dealer-document-upload
 * 
 * Handles document uploads for dealer registration and post-registration
 * document submissions (e.g. when admin requests additional documents).
 * 
 * Uses service_role to bypass RLS, since the user may have no active session
 * after signUp (email confirmation required), or may be a pending dealer
 * uploading documents from the locked dashboard.
 * 
 * Expects multipart/form-data with:
 * - file: The document file (PDF, JPG, PNG, max 10MB)
 * - user_id: The UUID of the user
 * - file_type: Type identifier:
 *     "trade_license"    – Gewerbeschein
 *     "gewerbenachweis"  – Gewerbenachweis
 *     "hrb"              – Handelsregisterauszug
 *     "ausweis_front"    – Ausweis Vorderseite
 *     "ausweis_back"     – Ausweis Rückseite
 * - dealer_application_id: (optional) UUID of the dealer application for legal_documents tracking
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- Inline CORS (same as _shared/cors.ts) ---
const ALLOWED_ORIGINS: string[] = [
  'https://caravanwert.de',
  'https://www.caravanwert.de',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}

function handleCorsPreflightRequest(req: Request): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(req) });
}
// --- End inline CORS ---

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** All supported file types and their human-readable German labels */
const FILE_TYPE_LABELS: Record<string, string> = {
  'trade_license': 'Gewerbeschein',
  'gewerbenachweis': 'Gewerbenachweis',
  'hrb': 'Handelsregisterauszug',
  'ausweis_front': 'Ausweis Vorderseite',
  'ausweis_back': 'Ausweis Rückseite',
};

/** Map file_type to the corresponding URL column in dealer_applications (legacy) */
const COLUMN_MAP: Record<string, string> = {
  'trade_license': 'trade_license_document_url',
  'gewerbenachweis': 'gewerbenachweis_url',
  'hrb': 'hrb_document_url',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // --- JWT Authentication: Verify the caller's identity ---
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentifizierung erforderlich' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    // Create a client with the user's JWT to verify their identity
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Ungültiges oder abgelaufenes Token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // --- End JWT Authentication ---

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('user_id') as string | null;
    const fileType = (formData.get('file_type') as string) || 'trade_license';
    const dealerApplicationId = formData.get('dealer_application_id') as string | null;

    // Validate inputs
    if (!file) {
      return new Response(JSON.stringify({ error: 'Keine Datei hochgeladen' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id erforderlich' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ error: 'Ungültige user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Authorization: Ensure the authenticated user matches the user_id ---
    // Admins (checked via user_roles) may upload on behalf of others
    if (authUser.id !== userId) {
      const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: roleData } = await supabaseService
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Sie können nur Dokumente für Ihr eigenes Konto hochladen' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate file_type
    if (!FILE_TYPE_LABELS[fileType]) {
      return new Response(JSON.stringify({ 
        error: `Ungültiger Dokumenttyp. Erlaubt: ${Object.keys(FILE_TYPE_LABELS).join(', ')}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate file type (MIME)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Ungültiger Dateityp. Erlaubt: PDF, JPG, PNG' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: 'Datei zu groß. Maximal 10 MB erlaubt.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service_role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user exists and is a dealer
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Benutzer nicht gefunden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userType = userData.user.user_metadata?.user_type;
    if (userType !== 'dealer') {
      return new Response(JSON.stringify({ error: 'Benutzer ist kein Händler' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload file to storage
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${userId}/${fileType}_${Date.now()}.${fileExt}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('dealer-documents')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Upload fehlgeschlagen: ' + uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create signed URL (valid for 10 years for legal documents)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('dealer-documents')
      .createSignedUrl(fileName, 10 * 365 * 24 * 60 * 60); // 10 years

    if (signedError) {
      console.error('Signed URL error:', signedError);
      return new Response(JSON.stringify({ error: 'Signierte URL konnte nicht erstellt werden' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const documentUrl = signedData.signedUrl;

    // --- Legacy: Update dealer_applications URL column (for trade_license, gewerbenachweis, hrb) ---
    const column = COLUMN_MAP[fileType];
    if (column) {
      const { error: updateError } = await supabase
        .from('dealer_applications')
        .update({ [column]: documentUrl })
        .eq('user_id', userId);

      if (updateError) {
        console.error('DB update error (dealer_applications):', updateError);
      }
    }

    // --- New: Create entry in legal_documents for tracking & admin verification ---
    // Resolve the dealer_application_id if not provided
    let resolvedAppId = dealerApplicationId;
    if (!resolvedAppId) {
      const { data: appData } = await supabase
        .from('dealer_applications')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      resolvedAppId = appData?.id || null;
    }

    if (resolvedAppId) {
      // Delete any existing document of the same type (replace, not duplicate)
      await supabase
        .from('legal_documents')
        .delete()
        .eq('dealer_application_id', resolvedAppId)
        .eq('document_type', fileType);

      // Insert new legal_documents entry
      const { error: legalDocError } = await supabase
        .from('legal_documents')
        .insert({
          dealer_application_id: resolvedAppId,
          document_type: fileType,
          document_name: FILE_TYPE_LABELS[fileType],
          document_url: documentUrl,
          file_url: documentUrl,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          uploaded_at: new Date().toISOString(),
          verified: false,
        });

      if (legalDocError) {
        console.error('legal_documents insert error:', legalDocError);
        // Non-critical: file is uploaded, just tracking failed
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      url: documentUrl,
      file_type: fileType,
      document_name: FILE_TYPE_LABELS[fileType],
      legal_document_tracked: !!resolvedAppId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unerwarteter Fehler' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
