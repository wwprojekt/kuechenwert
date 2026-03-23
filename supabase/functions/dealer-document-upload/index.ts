/**
 * Edge Function: dealer-document-upload
 * 
 * Handles document uploads for dealer registration.
 * Uses service_role to bypass RLS, since the user has no active session
 * after signUp (email confirmation required).
 * 
 * Expects multipart/form-data with:
 * - file: The document file (PDF, JPG, PNG, max 10MB)
 * - user_id: The UUID of the newly registered user
 * - file_type: Optional type identifier (e.g., "trade_license", "gewerbenachweis", "hrb")
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

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
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('user_id') as string | null;
    const fileType = (formData.get('file_type') as string) || 'trade_license';

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

    // Validate file type
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

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('dealer-documents')
      .getPublicUrl(fileName);

    // Determine which column to update based on file_type
    const columnMap: Record<string, string> = {
      'trade_license': 'trade_license_document_url',
      'gewerbenachweis': 'gewerbenachweis_url',
      'hrb': 'hrb_document_url',
    };
    const column = columnMap[fileType] || 'trade_license_document_url';

    // Update dealer_application with document URL
    const { error: updateError } = await supabase
      .from('dealer_applications')
      .update({ [column]: publicUrl })
      .eq('user_id', userId);

    if (updateError) {
      console.error('DB update error:', updateError);
      // File is uploaded but DB update failed - still return success with warning
      return new Response(JSON.stringify({ 
        success: true, 
        url: publicUrl,
        warning: 'Datei hochgeladen, aber Verknüpfung mit Antrag fehlgeschlagen'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      url: publicUrl,
      column: column,
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
