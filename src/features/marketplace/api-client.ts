import { supabase } from "@/integrations/supabase/client";
import { parseFunctionsError } from "@/lib/sessionGuard";

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const FALLBACK_MESSAGE = "Da ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.";

/**
 * Ruft eine Edge Function auf und wirft ApiError mit der (deutschen)
 * Fehlermeldung der Function. 5xx-Antworten werden einmal wiederholt.
 */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error) return data as T;
    const info = await parseFunctionsError(error);
    const status = info.status;
    const retryable = status !== undefined && status >= 500 && status !== 502;
    if (attempt === 0 && retryable) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      continue;
    }
    const parsed = typeof info.body === "object" && info.body ? (info.body as Record<string, unknown>) : {};
    const code = typeof parsed.code === "string" ? parsed.code : undefined;
    const message = status && status < 500 ? info.message : typeof parsed.error === "string" ? parsed.error : FALLBACK_MESSAGE;
    throw new ApiError(message || FALLBACK_MESSAGE, status, code);
  }
  throw new ApiError(FALLBACK_MESSAGE);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    const msg = (error as { message: string }).message;
    return msg.length > 0 && msg.length < 300 ? msg : FALLBACK_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}
