/**
 * Edge Function: upload-wizard-photos
 * 
 * Handles photo uploads for wizard sessions where the user has no active auth session
 * (e.g., email confirmation pending after signup).
 * 
 * Uses service_role to bypass Storage RLS policies.
 * verify_jwt = false so it can be called without authentication.
 * 
 * Expects multipart/form-data with:
 * - photos: One or more image files
 * - sessionId: The wizard session UUID (used as folder name)
 * 
 * RACE CONDITION HANDLING:
 * auto-convert-wizard and this function run concurrently.
 * auto-convert-wizard creates the motorhome in ~2s, but photo upload takes 30s-3min.
 * So auto-convert-wizard is almost always done BEFORE photos are uploaded.
 * 
 * Solution: After uploading photos, this function checks if the wizard_session
 * has already been converted (status='converted'). If so, it looks up the
 * motorhome_id from the admin_notes and creates motorhome_photos records directly.
 * This way, photos are correctly assigned regardless of execution order.
 * 
 * Returns: JSON with uploaded photo URLs and count
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/gif",
];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (same as wizard frontend limit)
const MAX_PHOTOS = 30;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const formData = await req.formData();
    const sessionId = formData.get("sessionId");

    if (!sessionId || typeof sessionId !== "string") {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers }
      );
    }

    // Validate sessionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return new Response(
        JSON.stringify({ error: "Invalid sessionId format" }),
        { status: 400, headers }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the wizard session exists
    const { data: session, error: sessionError } = await adminClient
      .from("wizard_sessions")
      .select("id, status, user_id, admin_notes")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Wizard session not found" }),
        { status: 404, headers }
      );
    }

    // Collect all photo files from the form data
    const photos: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "photos" && value instanceof File) {
        photos.push(value);
      }
    }

    if (photos.length === 0) {
      return new Response(
        JSON.stringify({ error: "No photos provided" }),
        { status: 400, headers }
      );
    }

    if (photos.length > MAX_PHOTOS) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_PHOTOS} photos allowed` }),
        { status: 400, headers }
      );
    }

    const uploadedUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        console.warn(`Skipping file ${file.name}: unsupported type ${file.type}`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`Skipping file ${file.name}: too large (${file.size} bytes)`);
        continue;
      }

      // Upload to wizard_temp/{sessionId}/ folder
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `wizard_temp/${sessionId}/${Date.now()}_${i}.${fileExt}`;

      const { error: uploadError } = await adminClient.storage
        .from("motorhome-photos")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(`Failed to upload ${fileName}:`, uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = adminClient.storage
        .from("motorhome-photos")
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    // Update wizard_sessions form_data with photo URLs
    if (uploadedUrls.length > 0) {
      const { data: currentSession } = await adminClient
        .from("wizard_sessions")
        .select("form_data, status, admin_notes, user_id")
        .eq("id", sessionId)
        .single();

      if (currentSession) {
        const updatedFormData = {
          ...(currentSession.form_data as Record<string, unknown> || {}),
          photoUrls: uploadedUrls,
        };

        await adminClient
          .from("wizard_sessions")
          .update({ form_data: updatedFormData })
          .eq("id", sessionId);

        // ===== RACE CONDITION FIX =====
        // auto-convert-wizard runs concurrently and is usually done in ~2s.
        // By the time photos are uploaded (30s-3min), the session is already
        // "converted" and a motorhome exists. But auto-convert couldn't assign
        // photos because they weren't uploaded yet.
        //
        // Solution: If the session is already converted, we assign photos
        // to the motorhome directly here.
        if (currentSession.status === "converted" && currentSession.admin_notes) {
          // Extract motorhome ID from admin_notes
          // Format: "[DD.MM.YYYY, HH:MM] Automatisch als Wohnmobil angelegt (ID: <uuid>)"
          const motorhomeIdMatch = currentSession.admin_notes.match(/\(ID:\s*([a-f0-9-]+)\)/i);
          
          if (motorhomeIdMatch) {
            const motorhomeId = motorhomeIdMatch[1];
            console.log(`Session already converted. Assigning ${uploadedUrls.length} photos to motorhome ${motorhomeId}`);

            // Check if motorhome_photos already exist for this motorhome
            const { data: existingPhotos } = await adminClient
              .from("motorhome_photos")
              .select("id")
              .eq("motorhome_id", motorhomeId);

            const startOrder = existingPhotos?.length || 0;

            // Create motorhome_photos records
            const photoRecords = uploadedUrls.map((url: string, index: number) => ({
              motorhome_id: motorhomeId,
              url: url,
              display_order: startOrder + index,
            }));

            const { error: photosInsertError } = await adminClient
              .from("motorhome_photos")
              .insert(photoRecords);

            if (photosInsertError) {
              console.error("Failed to insert motorhome photos:", photosInsertError.message);
            } else {
              console.log(`Successfully assigned ${photoRecords.length} photos to motorhome ${motorhomeId}`);
            }

            // Move photos from wizard_temp/{sessionId}/ to {sellerId}/
            const sellerId = currentSession.user_id;
            if (sellerId) {
              try {
                for (const url of uploadedUrls) {
                  const match = url.match(/wizard_temp\/[^/]+\/(.+)$/);
                  if (match) {
                    const fileName = match[1];
                    const oldPath = `wizard_temp/${sessionId}/${fileName}`;
                    const newPath = `${sellerId}/${fileName}`;
                    await adminClient.storage
                      .from("motorhome-photos")
                      .move(oldPath, newPath);

                    // Update the photo URL in motorhome_photos
                    const newPublicUrl = adminClient.storage
                      .from("motorhome-photos")
                      .getPublicUrl(newPath).data.publicUrl;

                    await adminClient
                      .from("motorhome_photos")
                      .update({ url: newPublicUrl })
                      .eq("motorhome_id", motorhomeId)
                      .eq("url", url);
                  }
                }
                console.log(`Moved photos from wizard_temp/${sessionId}/ to ${sellerId}/`);
              } catch (moveError) {
                console.error("Failed to move some photos (non-critical):", moveError);
              }
            }
          } else {
            console.warn("Session is converted but could not extract motorhome ID from admin_notes");
          }
        } else {
          console.log(`Session status: ${currentSession.status}. Photos saved to wizard_temp, auto-convert-wizard will assign them later.`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        urls: uploadedUrls,
        count: uploadedUrls.length,
      }),
      { status: 200, headers }
    );

  } catch (error: any) {
    console.error("Error in upload-wizard-photos:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers }
    );
  }
});
