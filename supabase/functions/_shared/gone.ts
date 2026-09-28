/**
 * Antwort stillgelegter Edge Functions: Caravan-Altbestand, Einmal-Werkzeuge
 * und der alte Planer. Sie bleiben als 410-Stub deployt, bis sie im
 * Supabase-Dashboard gelöscht werden; Repo und Produktion stimmen so überein.
 */
export function serveGone(name: string): void {
  Deno.serve(
    () =>
      new Response(JSON.stringify({ error: "Diese Funktion wurde stillgelegt.", code: "gone", function: name }), {
        status: 410,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }),
  );
}
