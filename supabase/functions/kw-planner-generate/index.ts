/**
 * KuechenWert Funnel C — AI-Traumkueche-Generator
 *
 * Flow:
 *   1. Client schickt Spec (Raumform, Stil, Farbe, Materialien, Region, ...)
 *   2. Wenn session_token fehlt, legen wir eine neue planner_session an.
 *   3. Rate-Limit per IP (max 5 Bilder / Stunde pro IP).
 *   4. Prompt-Enhancement via OpenAI (kompakter englischer Prompt aus den
 *      deutschen Spec-Antworten; Fallback auf Template wenn OpenAI nicht
 *      erreichbar ist).
 *   5. Bild-Generierung via FAL.ai (Flux Pro v1.1-Ultra).
 *   6. Bild in Storage-Bucket `planner-renders` hochladen.
 *   7. planner_renders-Eintrag erstellen, planner_sessions.current_render_id
 *      setzen, Price-Range aus kitchen_price_brackets berechnen.
 *
 * Secrets (Supabase Functions env):
 *   - OPENAI_API_KEY
 *   - FAL_API_KEY
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (automatisch injected)
 */

// @ts-ignore Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Deno global types for TS-checker.
// deno-lint-ignore no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const FAL_API_KEY = Deno.env.get("FAL_API_KEY") ?? "";

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1h
const RATE_LIMIT_MAX_IMAGES = 5;
const FAL_MODEL = "fal-ai/flux-pro/v1.1-ultra";

type SpecInput = {
  kitchen_form?: string;
  kitchen_style?: string;
  color_scheme?: string;
  front_material?: string;
  worktop_material?: string;
  appliance_segment?: string;
  special_wishes?: string[];
  room_notes?: string;
  postal_code?: string;
};

type GenerateBody = {
  session_token?: string;
  spec: SpecInput;
  user_message?: string;
  utm?: Record<string, string | undefined>;
};

// ---------------------------------------------------------------------------
// Prompt-Template (deterministischer Fallback wenn OpenAI down ist)
// ---------------------------------------------------------------------------

const STYLE_PROMPTS: Record<string, string> = {
  modern:
    "ultra-modern handleless German kitchen, glossy flat fronts, minimalist design",
  landhaus:
    "traditional German country house kitchen, framed wooden fronts, rustic charm",
  minimalistisch:
    "minimalist Scandinavian-inspired kitchen, clean surfaces, muted tones",
  industrial:
    "industrial loft kitchen, matte black and stainless steel accents, concrete-look worktop",
  klassisch:
    "timeless classic kitchen, framed fronts, elegant neutral palette",
  design:
    "high-end designer kitchen, premium brand feel (Bulthaup / SieMatic / Poggenpohl aesthetic), architectural detailing",
};

const FORM_PROMPTS: Record<string, string> = {
  zeile: "single-line galley layout",
  l: "L-shaped layout",
  u: "U-shaped layout",
  insel: "kitchen with a large cooking island",
  parallel: "two parallel counter rows",
  g: "G-shaped layout with peninsula",
};

const COLOR_PROMPTS: Record<string, string> = {
  warm: "warm neutral palette (cream, oak, beige)",
  cool: "cool neutral palette (light grey, white, brushed metal)",
  bold: "bold contrasting palette (deep navy or forest green with light oak)",
  natural: "natural wood and stone tones",
  mono: "monochrome palette (black, white, charcoal)",
};

function buildFallbackPrompt(spec: SpecInput, userMessage?: string): string {
  const style =
    STYLE_PROMPTS[(spec.kitchen_style ?? "modern").toLowerCase()] ??
    STYLE_PROMPTS.modern;
  const form =
    FORM_PROMPTS[(spec.kitchen_form ?? "l").toLowerCase()] ?? FORM_PROMPTS.l;
  const color =
    COLOR_PROMPTS[(spec.color_scheme ?? "warm").toLowerCase()] ??
    COLOR_PROMPTS.warm;

  const parts = [
    "Photorealistic interior photograph of a brand-new German kitchen",
    style,
    form,
    color,
    spec.front_material ? `front material: ${spec.front_material}` : "",
    spec.worktop_material ? `worktop: ${spec.worktop_material}` : "",
    spec.appliance_segment
      ? `${spec.appliance_segment}-segment built-in appliances (Miele / Bosch / Siemens style)`
      : "",
    "bright natural daylight through a large window",
    "soft indirect lighting, inviting atmosphere",
    "shot on 35mm, architectural interior photography, 8k, ultra-detailed",
  ].filter(Boolean);

  if (userMessage && userMessage.trim().length > 0) {
    parts.push(`user emphasis: ${userMessage.trim().slice(0, 200)}`);
  }

  return parts.join(", ");
}

const NEGATIVE_PROMPT =
  "people, faces, text, watermark, logo, signature, cartoon, drawing, blurry, distorted, low quality, cluttered, dirty, messy";

// ---------------------------------------------------------------------------
// OpenAI Prompt-Enhancement (optional — fallt durch wenn keine Key / Error)
// ---------------------------------------------------------------------------

async function enhancePromptWithOpenAI(
  spec: SpecInput,
  userMessage: string | undefined,
  fallback: string
): Promise<string> {
  if (!OPENAI_API_KEY) return fallback;

  const systemMsg =
    "Du bist ein Prompt-Engineer fuer photorealistische Kuechen-Renderings (Flux Pro). " +
    "Erzeuge einen kompakten ENGLISCHEN Prompt (max 80 Woerter, keine Zeilenumbrueche) " +
    "fuer eine deutsche Einbaukueche basierend auf dem JSON-Spec. Keine Personen. " +
    "Fokus: Material, Farbe, Form, Licht, Kameraperspektive. Architektur-Fotografie-Stil.";

  const userMsg = [
    "Spec:",
    JSON.stringify(spec),
    userMessage ? `\nZusatzwunsch: ${userMessage.slice(0, 300)}` : "",
    "\nAntworte NUR mit dem englischen Prompt-String, nichts anderes.",
  ].join("");

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 200,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!resp.ok) {
      console.warn("OpenAI non-OK, falling back:", resp.status);
      return fallback;
    }
    const data = await resp.json();
    const enhanced = data?.choices?.[0]?.message?.content?.trim();
    if (!enhanced || enhanced.length < 20) return fallback;
    return enhanced;
  } catch (err) {
    console.warn("OpenAI error, falling back:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// FAL.ai Bild-Generierung
// ---------------------------------------------------------------------------

async function generateFalImage(
  prompt: string
): Promise<{ imageUrl: string; requestId: string; width: number; height: number; durationMs: number }> {
  if (!FAL_API_KEY) {
    throw new Error("FAL_API_KEY not configured");
  }

  const start = Date.now();

  const resp = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1536, height: 1024 },
      num_inference_steps: 28,
      num_images: 1,
      enable_safety_checker: true,
      safety_tolerance: "2",
      output_format: "jpeg",
      raw: false,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`FAL.ai ${resp.status}: ${body.slice(0, 400)}`);
  }
  const data = await resp.json();
  const image = data?.images?.[0];
  if (!image?.url) {
    throw new Error("FAL.ai response has no image URL");
  }

  return {
    imageUrl: image.url as string,
    requestId: (data?.request_id ?? data?.id ?? "unknown") as string,
    width: (image.width ?? 1536) as number,
    height: (image.height ?? 1024) as number,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "kw_" + Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pickClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? null;
}

function mapSegment(raw?: string): "budget" | "mittel" | "premium" | "luxus" {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("luxus") || v.includes("design")) return "luxus";
  if (v.includes("premium") || v.includes("hochwertig")) return "premium";
  if (v.includes("budget") || v.includes("guenstig")) return "budget";
  return "mittel";
}

function mapWorktopTier(raw?: string): "basic" | "mid" | "premium" {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("naturstein") || v.includes("quarz") || v.includes("dekton")) return "premium";
  if (v.includes("laminat") || v.includes("spanplatte")) return "basic";
  return "mid";
}

function mapForm(raw?: string): "zeile" | "l" | "u" | "insel" | "parallel" | "g" {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("insel")) return "insel";
  if (v.includes("u")) return "u";
  if (v.includes("parallel") || v.includes("zweizeil")) return "parallel";
  if (v.includes("g")) return "g";
  if (v.includes("zeile") || v.includes("single")) return "zeile";
  return "l";
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);

  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const spec = body.spec ?? {};
  if (!spec.kitchen_form || !spec.kitchen_style) {
    return json(
      { error: "spec.kitchen_form + spec.kitchen_style sind Pflicht." },
      400
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // --- Rate-Limit per IP -----------------------------------------------------
  const ip = pickClientIp(req) ?? "unknown";
  const bucketKey = `fnC:gen:${ip}`;
  try {
    const { data: rl, error: rlErr } = await supabase.rpc(
      "planner_rate_limit_increment",
      {
        p_key: bucketKey,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        p_limit: RATE_LIMIT_MAX_IMAGES,
      }
    );
    if (rlErr) console.warn("rate-limit rpc error", rlErr);
    const row = Array.isArray(rl) ? rl[0] : rl;
    if (row && row.allowed === false) {
      return json(
        {
          error: "Rate limit erreicht. Bitte in einer Stunde erneut versuchen.",
          reset_at: row.reset_at,
        },
        429
      );
    }
  } catch (err) {
    console.warn("rate-limit check failed, continuing:", err);
  }

  // --- Session holen oder anlegen -------------------------------------------
  let sessionId: string;
  let sessionToken: string;

  if (body.session_token) {
    const { data: existing, error: sErr } = await supabase
      .from("planner_sessions")
      .select("id,session_token,status")
      .eq("session_token", body.session_token)
      .maybeSingle();
    if (sErr) console.warn("session lookup error", sErr);
    if (!existing) {
      return json({ error: "Session-Token unbekannt." }, 404);
    }
    sessionId = existing.id as string;
    sessionToken = existing.session_token as string;
  } else {
    sessionToken = generateSessionToken();
    const { data: inserted, error: insErr } = await supabase
      .from("planner_sessions")
      .insert({
        session_token: sessionToken,
        spec,
        ip_address: ip === "unknown" ? null : ip,
        user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
        utm_source: body.utm?.utm_source ?? null,
        utm_medium: body.utm?.utm_medium ?? null,
        utm_campaign: body.utm?.utm_campaign ?? null,
        utm_content: body.utm?.utm_content ?? null,
        utm_term: body.utm?.utm_term ?? null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.error("session create error", insErr);
      return json({ error: "Session konnte nicht angelegt werden." }, 500);
    }
    sessionId = inserted.id as string;
  }

  // Version = letzte + 1
  const { data: lastRender } = await supabase
    .from("planner_renders")
    .select("version")
    .eq("session_id", sessionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((lastRender?.version as number | undefined) ?? 0) + 1;

  // --- Prompt bauen ----------------------------------------------------------
  const fallbackPrompt = buildFallbackPrompt(spec, body.user_message);
  const prompt = await enhancePromptWithOpenAI(
    spec,
    body.user_message,
    fallbackPrompt
  );

  // --- Pending render-Row anlegen --------------------------------------------
  const { data: renderRow, error: rErr } = await supabase
    .from("planner_renders")
    .insert({
      session_id: sessionId,
      version: nextVersion,
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      spec_snapshot: spec,
      user_message: body.user_message ?? null,
      status: "pending",
      model_slug: FAL_MODEL,
    })
    .select("id")
    .single();
  if (rErr || !renderRow) {
    console.error("render insert error", rErr);
    return json({ error: "Render-Datensatz nicht anlegbar." }, 500);
  }
  const renderId = renderRow.id as string;

  // --- FAL.ai aufrufen -------------------------------------------------------
  let falResult;
  try {
    falResult = await generateFalImage(prompt);
  } catch (err) {
    console.error("FAL.ai error", err);
    await supabase
      .from("planner_renders")
      .update({
        status: "failed",
        error_message: String(err).slice(0, 500),
        completed_at: new Date().toISOString(),
      })
      .eq("id", renderId);
    return json({ error: "Bild-Generierung fehlgeschlagen.", detail: String(err).slice(0, 200) }, 502);
  }

  // --- Bild in Storage kopieren ---------------------------------------------
  let storedPath = "";
  let publicUrl = falResult.imageUrl;
  try {
    const imageResp = await fetch(falResult.imageUrl);
    if (!imageResp.ok) throw new Error(`Image fetch ${imageResp.status}`);
    const bytes = new Uint8Array(await imageResp.arrayBuffer());
    storedPath = `${sessionId}/v${nextVersion}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("planner-renders")
      .upload(storedPath, bytes, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (upErr) throw upErr;
    const { data: pu } = supabase.storage
      .from("planner-renders")
      .getPublicUrl(storedPath);
    if (pu?.publicUrl) publicUrl = pu.publicUrl;
  } catch (err) {
    console.warn("Storage-Upload gescheitert, nutze FAL-URL als Fallback:", err);
  }

  // --- Preis-Range berechnen (kitchen_price_brackets) -----------------------
  let priceMinCents: number | null = null;
  let priceMaxCents: number | null = null;
  try {
    const { data: bracket } = await supabase
      .from("kitchen_price_brackets")
      .select("price_min_cents,price_max_cents")
      .eq("style_segment", mapSegment(spec.kitchen_style))
      .eq("appliance_segment", mapSegment(spec.appliance_segment))
      .eq("worktop_tier", mapWorktopTier(spec.worktop_material))
      .eq("kitchen_form", mapForm(spec.kitchen_form))
      .eq("active", true)
      .maybeSingle();
    if (bracket) {
      priceMinCents = bracket.price_min_cents as number;
      priceMaxCents = bracket.price_max_cents as number;
    }
  } catch (err) {
    console.warn("price-bracket lookup failed", err);
  }

  // --- Render finalisieren ---------------------------------------------------
  await supabase
    .from("planner_renders")
    .update({
      status: "success",
      image_path: storedPath || null,
      image_width: falResult.width,
      image_height: falResult.height,
      fal_request_id: falResult.requestId,
      generation_ms: falResult.durationMs,
      completed_at: new Date().toISOString(),
    })
    .eq("id", renderId);

  await supabase
    .from("planner_sessions")
    .update({
      current_render_id: renderId,
      spec,
      price_range_min_cents: priceMinCents,
      price_range_max_cents: priceMaxCents,
    })
    .eq("id", sessionId);

  return json({
    ok: true,
    session_token: sessionToken,
    render_id: renderId,
    version: nextVersion,
    image_url: publicUrl,
    price_range: priceMinCents !== null && priceMaxCents !== null
      ? { min_eur: Math.round(priceMinCents / 100), max_eur: Math.round(priceMaxCents / 100) }
      : null,
    prompt_used_openai: prompt !== fallbackPrompt,
  });
});
