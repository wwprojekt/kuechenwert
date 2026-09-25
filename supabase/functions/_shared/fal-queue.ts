/**
 * fal.ai Queue-Client (submit → status → result).
 *
 * Bildgenerierung dauert 10–60 s. Statt die HTTP-Verbindung offen zu halten,
 * wird der Job eingereiht und der Client pollt über kw-planner/status. So
 * überleben Renders Verbindungsabbrüche, und Varianten laufen parallel.
 */

const FAL_KEY = Deno.env.get("FAL_API_KEY") ?? Deno.env.get("FAL_KEY") ?? "";

export const FAL_EDIT_MODEL = Deno.env.get("FAL_EDIT_MODEL") ?? "fal-ai/nano-banana-pro/edit";
export const FAL_TEXT_MODEL = Deno.env.get("FAL_TEXT_MODEL") ?? "fal-ai/flux-2-pro";

export interface FalSubmission {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

export type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "UNKNOWN";

function headers(): HeadersInit {
  if (!FAL_KEY) throw new Error("FAL_API_KEY ist nicht konfiguriert");
  return { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" };
}

export function buildFalInput(
  mode: "edit" | "text",
  prompt: string,
  imageUrl?: string | null,
): { model: string; input: Record<string, unknown> } {
  if (mode === "edit") {
    return {
      model: FAL_EDIT_MODEL,
      input: {
        prompt,
        image_urls: [imageUrl],
        num_images: 1,
        aspect_ratio: "auto",
        resolution: "2K",
        output_format: "jpeg",
        safety_tolerance: "4",
      },
    };
  }
  return {
    model: FAL_TEXT_MODEL,
    input: {
      prompt,
      image_size: { width: 1536, height: 1024 },
      output_format: "jpeg",
      safety_tolerance: "2",
      enable_safety_checker: true,
    },
  };
}

export async function falSubmit(model: string, input: Record<string, unknown>): Promise<FalSubmission> {
  const resp = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`fal submit ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  if (!data?.request_id || !data?.status_url || !data?.response_url) {
    throw new Error("fal submit: unvollständige Antwort");
  }
  return { requestId: data.request_id, statusUrl: data.status_url, responseUrl: data.response_url };
}

export async function falStatus(statusUrl: string): Promise<FalStatus> {
  const resp = await fetch(statusUrl, { headers: headers() });
  if (!resp.ok) {
    if (resp.status >= 500) return "UNKNOWN";
    const text = await resp.text().catch(() => "");
    throw new Error(`fal status ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  const status = String(data?.status ?? "UNKNOWN");
  return status === "IN_QUEUE" || status === "IN_PROGRESS" || status === "COMPLETED" ? status : "UNKNOWN";
}

export async function falResultImage(responseUrl: string): Promise<{ url: string; width?: number; height?: number }> {
  const resp = await fetch(responseUrl, { headers: headers() });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`fal result ${resp.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const image = data?.images?.[0] ?? data?.image;
  if (!image?.url) throw new Error("fal result: kein Bild enthalten");
  return { url: image.url, width: image.width, height: image.height };
}
