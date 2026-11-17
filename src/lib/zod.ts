/**
 * zod mit den deutschen Meldungen der Plattform. Jedes Schema importiert `z` von hier, nicht von
 * "zod": Erst beim ersten Formular lädt der Browser zod, und die Karte ist gesetzt, bevor ein
 * Schema prüft. zod 4 ist im Bündel rund 13 KiB (gzip) größer als zod 3; mit der Einrichtung in
 * main.tsx hätte jede Seite sie beim Start mitgeladen (17.11.2026). `germanZodErrorMap.test.ts`
 * hält direkte Importe auf.
 */
import { z } from "zod";
import { germanZodErrorMap } from "./germanErrors";

z.config({ customError: germanZodErrorMap });

export { z };
