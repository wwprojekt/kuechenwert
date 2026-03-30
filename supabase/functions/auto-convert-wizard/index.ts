import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { edgeLogger } from "../_shared/edgeLogger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AutoConvertRequest {
  sessionId: string;
}

// Helper: Map wizard form_data fields to motorhome DB fields
function mapWizardToMotorhome(formData: Record<string, any>) {
  return {
    manufacturer: String(formData.manufacturer || ""),
    model: String(formData.model || ""),
    year: Number(formData.year) || new Date().getFullYear(),
    mileage: Number(formData.mileage) || 0,
    body_type: String(formData.bodyType || "Kastenwagen"),
    condition: String(formData.condition || "Gut"),
    description: String(formData.description || ""),
    sale_channel: String(formData.saleChannel || "auction") === "instant_price" ? "auction" : String(formData.saleChannel || "auction"),
    reserve_price: formData.reservePrice ? Number(formData.reservePrice) : (formData.desiredPrice ? Number(formData.desiredPrice) : null),
    instant_price: formData.desiredPrice ? Number(formData.desiredPrice) : (formData.instantPrice ? Number(formData.instantPrice) : null),
    fuel_type: formData.fuelType ? String(formData.fuelType) : null,
    transmission: formData.transmission ? String(formData.transmission) : null,
    engine_power_hp: formData.enginePower ? Number(formData.enginePower) : null,
    engine_displacement_ccm: formData.engine_displacement_ccm ? Number(formData.engine_displacement_ccm) : null,
    emission_class: formData.emissionClass ? String(formData.emissionClass) : null,
    length_m: formData.length_m ? Number(formData.length_m) : null,
    width_m: formData.width_m ? Number(formData.width_m) : null,
    height_m: formData.height_m ? Number(formData.height_m) : null,
    weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
    payload_kg: formData.payload_kg ? Number(formData.payload_kg) : null,
    seats: formData.number_of_seats ? Number(formData.number_of_seats) : null,
    sleeping_places: formData.number_of_sleeping_places ? Number(formData.number_of_sleeping_places) : null,
    number_of_axles: formData.number_of_axles ? Number(formData.number_of_axles) : null,
    has_bathroom: Boolean(formData.has_bathroom),
    has_kitchen: Boolean(formData.has_kitchen),
    has_shower: Boolean(formData.has_shower),
    has_toilet: Boolean(formData.has_toilet),
    has_heating: Boolean(formData.has_heating),
    has_air_conditioning: Boolean(formData.has_air_conditioning),
    has_solar: Boolean(formData.has_solar_panel),
    has_awning: Boolean(formData.has_awning),
    has_bike_rack: Boolean(formData.has_bike_rack),
    has_navigation: Boolean(formData.has_navigation),
    has_backup_camera: Boolean(formData.has_backup_camera),
    has_cruise_control: Boolean(formData.has_cruise_control),
    has_garage: Boolean(formData.has_garage),
    has_alarm: Boolean(formData.has_alarm_system || formData.has_alarm),
    has_esp: Boolean(formData.has_esp),
    has_swivel_seats: Boolean(formData.has_swivel_seats),
    has_satellite: Boolean(formData.has_satellite_system),
    has_tv: Boolean(formData.has_tv),
    accident_free: formData.accident_free != null ? Boolean(formData.accident_free) : null,
    first_registration: formData.first_registration ? String(formData.first_registration) : null,
    tuev_valid_until: formData.tuev_valid_until ? String(formData.tuev_valid_until) : null,
    previous_owners: formData.previous_owners ? Number(formData.previous_owners) : null,
    water_tank_liters: formData.water_tank_liters ? Number(formData.water_tank_liters) : null,
    grey_water_capacity_liters: formData.waste_water_tank_liters ? Number(formData.waste_water_tank_liters) : null,
    gas_system: formData.gas_system ? String(formData.gas_system) : null,
    refrigerator_type: formData.refrigerator_type ? String(formData.refrigerator_type) : null,
    main_tires: formData.main_tires ? String(formData.main_tires) : null,
    second_tires: formData.second_tires ? String(formData.second_tires) : null,
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

    if (session.status === "converted") {
      return new Response(
        JSON.stringify({ message: "Session already converted" }),
        { status: 200, headers }
      );
    }

    const formData = session.form_data || {};
    const customerEmail = session.customer_email || formData.customerEmail || "";
    const customerName = session.customer_name || formData.customerName || "";
    const customerPhone = session.customer_phone || formData.customerPhone || "";

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: "No customer email found in session" }),
        { status: 400, headers }
      );
    }

    // 2. Create or find User
    let sellerId = session.user_id;
    let isNewUser = false;

    if (!sellerId) {
      const nameParts = customerName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Check if user exists
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", customerEmail.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        sellerId = existingProfile.id;
      } else {
        // Create user
        const randomPassword = crypto.randomUUID() + "Aa1!";
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: customerEmail.trim().toLowerCase(),
          password: randomPassword,
          email_confirm: false,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            phone: customerPhone,
          },
        });

        if (createError) {
          // Maybe exists in auth but not profile
          const { data: profileByEmail } = await adminClient
            .from("profiles")
            .select("id")
            .eq("email", customerEmail.trim().toLowerCase())
            .maybeSingle();
            
          if (profileByEmail) {
            sellerId = profileByEmail.id;
          } else {
            throw new Error(`Failed to create user: ${createError.message}`);
          }
        } else {
          sellerId = newUser.user.id;
          isNewUser = true;

          // Create profile
          await adminClient.from("profiles").upsert({
            id: sellerId,
            email: customerEmail.trim().toLowerCase(),
            first_name: firstName || null,
            last_name: lastName || null,
            phone: customerPhone || null,
            account_type: "private",
          }, { onConflict: "id" });

          // Assign role
          await adminClient.from("user_roles").upsert({
            user_id: sellerId,
            role: "seller",
          }, { onConflict: "user_id" });
        }
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
      // reserve_price is already set in mapWizardToMotorhome
    };

    const { data: motorhome, error: insertError } = await adminClient
      .from("motorhomes")
      .insert(motorhomePayload)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create motorhome: ${insertError.message}`);
    }

    // 4. Create Auction if needed
    if (motorhomePayload.sale_channel === "auction") {
      await adminClient.from("auctions").insert({
        motorhome_id: motorhome.id,
        starting_bid: 50,
        reserve_price: motorhomePayload.reserve_price,
        status: "draft",
      });
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

    // 6. Send Registration Invite (only if new user or explicitly requested)
    // We always send it so they get the magic link to login and see their dashboard
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
      }),
    });

    if (!inviteRes.ok) {
      edgeLogger.error("Failed to send registration invite:", await inviteRes.text());
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
