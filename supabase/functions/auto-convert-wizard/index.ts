import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

import { edgeLogger } from "../_shared/edgeLogger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AutoConvertRequest {
  sessionId: string;
  password?: string;
  userId?: string;
  hasPassword?: boolean;
}

// Helper: Map wizard form_data fields to motorhome DB fields
// IMPORTANT: Field names must match what useWizardForm.ts stores in form_data
function mapWizardToMotorhome(formData: Record<string, any>) {
  const isWohnwagen = formData.vehicleType === "Wohnwagen";

  return {
    // Core vehicle info
    manufacturer: String(formData.manufacturer || ""),
    model: String(formData.model || ""),
    year: Number(formData.year) || new Date().getFullYear(),
    mileage: isWohnwagen ? 0 : (Number(formData.mileage) || 0),
    body_type: String(formData.bodyType || "Kastenwagen"),
    condition: String(formData.condition || "Gut"),
    description: String(formData.description || `${formData.manufacturer || ''} ${formData.model || ''} (${formData.year || ''})`),

    // Sale info
    sale_channel: String(formData.saleChannel || "auction"),
    reserve_price: formData.reservePrice ? Number(formData.reservePrice) : null,
    instant_price: formData.instantPrice ? Number(formData.instantPrice) : null,

    // Technical details (wizard uses fuel_type, power_ps, emission_class directly)
    base_vehicle: isWohnwagen ? null : (formData.baseVehicle || null),
    fuel_type: isWohnwagen ? null : (formData.fuel_type || formData.fuelType || null),
    transmission: isWohnwagen ? null : (formData.transmission || null),
    engine_power_hp: isWohnwagen ? null : (formData.power_ps ? Number(formData.power_ps) : (formData.enginePower ? Number(formData.enginePower) : null)),
    engine_displacement_ccm: isWohnwagen ? null : (formData.engine_displacement_ccm ? Number(formData.engine_displacement_ccm) : null),
    emission_class: isWohnwagen ? null : (formData.emission_class || formData.emissionClass || null),
    first_registration: formData.first_registration ? String(formData.first_registration) : null,
    tuev_valid_until: formData.tuv_valid_until || formData.tuev_valid_until ? String(formData.tuv_valid_until || formData.tuev_valid_until) : null,
    previous_owners: formData.previous_owners != null ? Number(formData.previous_owners) : null,
    accident_free: formData.accident_free != null ? Boolean(formData.accident_free) : null,
    non_smoker: formData.non_smoker != null ? Boolean(formData.non_smoker) : null,
    service_history_available: formData.service_history_available != null ? Boolean(formData.service_history_available) : null,
    main_tires: formData.main_tires ? String(formData.main_tires) : null,
    second_tires: formData.second_tires ? String(formData.second_tires) : null,

    // Dimensions (wizard stores in cm, DB expects meters for length/width/height)
    length_m: formData.length_cm ? Number(formData.length_cm) / 100 : (formData.length_m ? Number(formData.length_m) : null),
    width_m: formData.width_cm ? Number(formData.width_cm) / 100 : (formData.width_m ? Number(formData.width_m) : null),
    height_m: formData.height_cm ? Number(formData.height_cm) / 100 : (formData.height_m ? Number(formData.height_m) : null),
    weight_kg: formData.total_weight_kg ? Number(formData.total_weight_kg) : (formData.weight_kg ? Number(formData.weight_kg) : null),
    payload_kg: formData.payload_kg ? Number(formData.payload_kg) : null,
    number_of_axles: formData.number_of_axles ? Number(formData.number_of_axles) : null,
    seats: isWohnwagen ? null : (formData.seats_with_seatbelts ? Number(formData.seats_with_seatbelts) : (formData.number_of_seats ? Number(formData.number_of_seats) : null)),
    sleeping_places: formData.sleeping_places ? Number(formData.sleeping_places) : (formData.number_of_sleeping_places ? Number(formData.number_of_sleeping_places) : null),
    beds_description: formData.beds_description || null,

    // Interior
    has_kitchen: Boolean(formData.has_kitchen),
    heating_type: formData.heating_type || null,
    air_conditioning_type: formData.air_conditioning || null,
    has_bathroom: Boolean(formData.has_toilet || formData.has_shower || formData.has_bathroom),
    has_shower: Boolean(formData.has_shower),
    has_toilet: Boolean(formData.has_toilet),
    water_tank_liters: formData.fresh_water_capacity_liters ? Number(formData.fresh_water_capacity_liters) : (formData.water_tank_liters ? Number(formData.water_tank_liters) : null),
    grey_water_capacity_liters: formData.grey_water_capacity_liters ? Number(formData.grey_water_capacity_liters) : (formData.waste_water_tank_liters ? Number(formData.waste_water_tank_liters) : null),

    // Equipment & Features
    has_airbag: isWohnwagen ? false : Boolean(formData.has_airbag),
    has_alarm: Boolean(formData.has_alarm || formData.has_alarm_system),
    has_swivel_seats: isWohnwagen ? false : Boolean(formData.has_swivel_seats),
    has_esp: isWohnwagen ? false : Boolean(formData.has_esp),
    has_cruise_control: isWohnwagen ? false : Boolean(formData.has_cruise_control),
    has_parking_sensors: isWohnwagen ? false : Boolean(formData.has_parking_sensors),
    has_backup_camera: Boolean(formData.has_reversing_camera || formData.has_backup_camera),
    has_central_locking: Boolean(formData.has_central_locking),
    has_solar: Boolean(formData.has_solar || formData.has_solar_panel),
    solar_power_watts: formData.solar_power_watts ? Number(formData.solar_power_watts) : null,
    battery_capacity_ah: formData.battery_capacity_ah ? Number(formData.battery_capacity_ah) : null,
    has_inverter: Boolean(formData.has_inverter),
    has_awning: Boolean(formData.has_awning),
    awning_length_m: formData.awning_length_cm ? Number(formData.awning_length_cm) / 100 : null,
    has_bike_rack: Boolean(formData.has_bike_rack),
    has_garage: Boolean(formData.has_garage),
    has_tv: Boolean(formData.has_tv_sat || formData.has_tv),
    has_satellite: Boolean(formData.has_tv_sat || formData.has_satellite_system),
    has_awning_tent: Boolean(formData.has_awning_tent),
    has_roof_ac: Boolean(formData.has_roof_ac),
    has_stand_ac: Boolean(formData.has_stand_ac),

    // Defects
    has_damage: formData.no_known_defects != null ? !Boolean(formData.no_known_defects) : null,
    damage_summary: formData.known_defects ? String(formData.known_defects) : null,

    // Location
    postal_code: formData.zipCode ? String(formData.zipCode) : null,
    city: formData.city ? String(formData.city) : null,
    country: formData.country ? String(formData.country) : "DE",

    // Additional
    additional_equipment: formData.additional_equipment || null,
    vehicle_identification_number: formData.vehicle_identification_number || null,
    license_plate: formData.license_plate || null,
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  try {
    const body: AutoConvertRequest = await req.json();

    if (!body.sessionId) {
      return new Response(
        JSON.stringify({ error: "Session ID is required" }),
        { status: 400, headers }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get Wizard Session
    const { data: session, error: sessionError } = await adminClient
      .from("wizard_sessions")
      .select("*")
      .eq("id", body.sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers }
      );
    }

    if (session.status !== 'completed' && session.status !== 'converted') {
      return new Response(
        JSON.stringify({ error: "Session not in a convertible state" }),
        { status: 400, headers }
      );
    }

    const sessionAge = Date.now() - new Date(session.completed_at || session.created_at).getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) {
      edgeLogger.warn(`Session ${body.sessionId} is older than 24h, rejecting auto-convert`);
      return new Response(
        JSON.stringify({ error: "Session expired" }),
        { status: 410, headers }
      );
    }

    if (session.status === "converted") {
      // Safety check: verify a motorhome actually exists for this user.
      // If not, the previous conversion partially failed → allow re-conversion.
      if (session.user_id) {
        const { data: existingMotorhome } = await adminClient
          .from("motorhomes")
          .select("id")
          .eq("seller_id", session.user_id)
          .limit(1)
          .maybeSingle();

        if (existingMotorhome) {
          return new Response(
            JSON.stringify({ message: "Session already converted", motorhomeId: existingMotorhome.id }),
            { status: 200, headers }
          );
        }
        // No motorhome found despite "converted" status → partial failure, continue
        edgeLogger.warn(`Session ${body.sessionId} marked as converted but no motorhome found for user ${session.user_id}. Re-converting...`);
      } else {
        return new Response(
          JSON.stringify({ message: "Session already converted" }),
          { status: 200, headers }
        );
      }
    }

    const formData = session.form_data || {};
    const customerEmail = session.customer_email || formData.customerEmail || "";
    const customerName = session.customer_name || formData.customerName || "";
    const customerPhone = session.customer_phone || formData.customerPhone || "";

    // Extract address from form_data for profile
    const addressStreet = [formData.street, formData.houseNumber].filter(Boolean).join(' ') || null;
    const addressZip = formData.zipCode ? String(formData.zipCode) : null;
    const addressCity = formData.city ? String(formData.city) : null;
    const addressCountry = formData.country ? String(formData.country) : null;

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: "No customer email found in session" }),
        { status: 400, headers }
      );
    }

    // 2. Create or find User
    // Priority: body.userId > session.user_id > search by email > create new
    let sellerId = body.userId || session.user_id;
    let isNewUser = false;

    if (!sellerId) {
      const nameParts = customerName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const normalizedEmail = customerEmail.trim().toLowerCase();

      // Check profiles table first (fast, indexed lookup)
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id, email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingProfile) {
        sellerId = existingProfile.id;
        
        // Ensure profile exists
        await adminClient.from("profiles").upsert({
          id: sellerId,
          email: customerEmail.trim().toLowerCase(),
          first_name: firstName || null,
          last_name: lastName || null,
          phone: customerPhone || null,
          account_type: "private",
          address_street: addressStreet,
          address_zip: addressZip,
          address_city: addressCity,
          address_country: addressCountry,
        }, { onConflict: "id" });
        
        // Ensure role exists – but NEVER overwrite dealer with seller
        const { data: existingRoleForExisting } = await adminClient
          .from("user_roles").select("role").eq("user_id", sellerId).maybeSingle();
        if (!existingRoleForExisting) {
          const { error: roleInsertErr } = await adminClient.from("user_roles").insert({ user_id: sellerId, role: "seller" });
          if (roleInsertErr) edgeLogger.error("Failed to insert seller role:", roleInsertErr.message);
        }
        
      } else {
        // Profile not found — check auth.users by email (paginated search)
        let existingAuthUser: { id: string } | null = null;
        let page = 1;
        const perPage = 500;
        while (!existingAuthUser) {
          const { data: authListResult } = await adminClient.auth.admin.listUsers({ page, perPage });
          const found = authListResult?.users?.find(
            (u: any) => u.email?.toLowerCase() === normalizedEmail
          );
          if (found) { existingAuthUser = { id: found.id }; break; }
          if (!authListResult?.users || authListResult.users.length < perPage) break;
          page++;
        }

        if (existingAuthUser) {
          sellerId = existingAuthUser.id;

          await adminClient.from("profiles").upsert({
            id: sellerId,
            email: normalizedEmail,
            first_name: firstName || null,
            last_name: lastName || null,
            phone: customerPhone || null,
            account_type: "private",
            address_street: addressStreet,
            address_zip: addressZip,
            address_city: addressCity,
            address_country: addressCountry,
          }, { onConflict: "id" });

          const { data: existingRoleForAuth } = await adminClient
            .from("user_roles").select("role").eq("user_id", sellerId).maybeSingle();
          if (!existingRoleForAuth) {
            const { error: roleErr2 } = await adminClient.from("user_roles").insert({ user_id: sellerId, role: "seller" });
            if (roleErr2) edgeLogger.error("Failed to insert seller role:", roleErr2.message);
          }
        } else {
          // Create user via Admin API (NOT via signUp()!)
          const passwordToUse = body.password || (crypto.randomUUID() + "Aa1!");
          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: normalizedEmail,
            password: passwordToUse,
            email_confirm: true,
            user_metadata: {
              first_name: firstName,
              last_name: lastName,
              phone: customerPhone,
            },
          });

          if (createError) {
            throw new Error(`Failed to create user: ${createError.message}`);
          } else {
            sellerId = newUser.user.id;
            isNewUser = true;

            await adminClient.from("profiles").upsert({
              id: sellerId,
              email: normalizedEmail,
              first_name: firstName || null,
              last_name: lastName || null,
              phone: customerPhone || null,
              account_type: "private",
              address_street: addressStreet,
              address_zip: addressZip,
              address_city: addressCity,
              address_country: addressCountry,
            }, { onConflict: "id" });

            await adminClient.from("user_roles").upsert({
              user_id: sellerId,
              role: "seller",
            }, { onConflict: "user_id" });
          }
        }
      }
    }

    // 2b. Ensure profile and role exist for the seller (regardless of how we found them)
    if (sellerId) {
      const nameParts = customerName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      // Always ensure profile exists
      await adminClient.from("profiles").upsert({
        id: sellerId,
        email: customerEmail.trim().toLowerCase(),
        first_name: firstName || null,
        last_name: lastName || null,
        phone: customerPhone || null,
        account_type: "private",
        address_street: addressStreet,
        address_zip: addressZip,
        address_city: addressCity,
        address_country: addressCountry,
      }, { onConflict: "id" });

      // Ensure role exists – but NEVER overwrite a dealer role with seller
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", sellerId)
        .maybeSingle();

      if (!existingRole) {
        const { error: finalRoleErr } = await adminClient.from("user_roles").insert({
          user_id: sellerId,
          role: "seller",
        });
        if (finalRoleErr) edgeLogger.error("Failed to assign seller role:", finalRoleErr.message);
        else edgeLogger.info(`Assigned seller role to ${sellerId}`);
      } else {
        edgeLogger.info(`Kept existing role '${existingRole.role}' for ${sellerId}`);
      }
    }

    // 3. Create Motorhome
    const mappedData = mapWizardToMotorhome(formData);
    
    // Fallbacks for required fields
    const manufacturer = mappedData.manufacturer || "Unbekannt";
    const model = mappedData.model || "Unbekannt";
    const year = mappedData.year || new Date().getFullYear();
    const mileage = mappedData.mileage || 0;
    const bodyType = mappedData.body_type || "Kastenwagen";
    const condition = mappedData.condition || "Gut";

    const motorhomePayload = {
      ...mappedData,
      seller_id: sellerId,
      manufacturer,
      model,
      year,
      mileage,
      body_type: bodyType,
      condition,
      status: "available",
      gclid: session.gclid || null,
      gbraid: session.gbraid || null,
      wbraid: session.wbraid || null,
    };

    const { data: motorhome, error: insertError } = await adminClient
      .from("motorhomes")
      .insert(motorhomePayload)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create motorhome: ${insertError.message}`);
    }

    // 3b. Transfer photos from wizard_temp to motorhome_photos
    const photoUrls: string[] = formData.photoUrls || [];
    if (photoUrls.length > 0) {
      const photoRecords = photoUrls.map((url: string, index: number) => ({
        motorhome_id: motorhome.id,
        url: url,
        display_order: index,
      }));

      const { error: photosError } = await adminClient
        .from("motorhome_photos")
        .insert(photoRecords);

      if (photosError) {
        edgeLogger.error("Failed to insert motorhome photos:", photosError.message);
      } else {
        edgeLogger.info(`Inserted ${photoRecords.length} photos for motorhome ${motorhome.id}`);
      }

      // Move photos from wizard_temp/{sessionId}/ to {sellerId}/
      // This ensures photos are in the correct user folder for future management
      try {
        for (const url of photoUrls) {
          const match = url.match(/wizard_temp\/[^/]+\/(.+)$/);
          if (match) {
            const fileName = match[1];
            const oldPath = `wizard_temp/${body.sessionId}/${fileName}`;
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
              .eq("motorhome_id", motorhome.id)
              .eq("url", url);
          }
        }
      } catch (moveError) {
        edgeLogger.error("Failed to move some photos (non-critical):", moveError);
      }
    }

    // 4. Create Auction listing (for both 'auction' and 'instant_price' channels)
    // instant_price vehicles use the auction as a listing container but disable bidding
    if (motorhomePayload.sale_channel === "auction" || motorhomePayload.sale_channel === "instant_price") {
      const isInstantOnly = motorhomePayload.sale_channel === "instant_price";
      const { error: auctionInsertErr } = await adminClient.from("auctions").insert({
        motorhome_id: motorhome.id,
        starting_bid: isInstantOnly ? 0 : 50,
        reserve_price: isInstantOnly ? motorhomePayload.instant_price : motorhomePayload.reserve_price,
        status: "draft",
      });
      if (auctionInsertErr) {
        throw new Error(`Failed to create auction: ${auctionInsertErr.message}`);
      }
    }

    // 5. Update Wizard Session
    const timestamp = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const convertNote = `[${timestamp}] Automatisch als Wohnmobil angelegt (ID: ${motorhome.id})`;
    
    await adminClient
      .from("wizard_sessions")
      .update({
        status: "converted",
        user_id: sellerId,
        admin_notes: session.admin_notes ? `${session.admin_notes}\n${convertNote}` : convertNote,
      })
      .eq("id", body.sessionId);

    // 6. Send Registration Invite Email
    // User wurde bereits mit email_confirm: true erstellt (Zeile 215),
    // daher sendet Supabase KEINE automatische Bestätigungs-E-Mail.
    // Wir senden nur unsere Custom-Aktivierungs-E-Mail.
    // When hasPassword=true, the redirect goes to /dashboard (no password setup needed)
    const inviteRes = await fetch(`${SUPABASE_URL}/functions/v1/send-registration-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email: customerEmail,
        customerName: customerName,
        motorhomeId: motorhome.id,
        sessionId: body.sessionId,
        hasPassword: body.hasPassword || false,
      }),
    });

    if (!inviteRes.ok) {
      edgeLogger.error("Failed to send registration invite:", await inviteRes.text());
    }

    try {
      await adminClient.rpc('record_agb_acceptance', { p_user_id: sellerId, p_context: 'wizard' });
      edgeLogger.info(`Recorded AGB acceptance for wizard user ${sellerId}`);
    } catch (agbErr) {
      edgeLogger.error("Failed to record AGB acceptance:", agbErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        motorhomeId: motorhome.id,
        userId: sellerId,
      }),
      { status: 200, headers }
    );

  } catch (error: any) {
    edgeLogger.error("Error in auto-convert-wizard:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Interner Serverfehler" }),
      { status: 500, headers }
    );
  }
};

serve(handler);
