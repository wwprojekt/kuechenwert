/**
 * Wertrechner-Kernlogik — zentrale Re-Exports.
 *
 * Das Modul ist intentional stateless und UI-unabhaengig, damit es
 * - im Frontend (Wertrechner.tsx, eventuelle Admin-Tools)
 * - in Unit-Tests (vitest)
 * - und potenziell von Edge Functions (via npm:) genutzt werden kann.
 */
export * from "./bodyTypes";
export * from "./conditions";
export * from "./depreciation";
export * from "./manufacturers";
export * from "./modelFactors";
export * from "./modelYearRanges";
export * from "./tiers";
export * from "./algorithm";
export * from "./schema";
