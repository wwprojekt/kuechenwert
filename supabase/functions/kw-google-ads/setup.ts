/**
 * Sollzustand des KüchenWert-Google-Ads-Kontos, wiederholbar:
 * 1. Konto hängt unter dem Verwaltungskonto (Einladung + Annahme per API).
 * 2. Webseiten-Conversion „Küchenanfrage“ (Lead-Formular, eine pro Klick,
 *    primär). Ihr send_to gehört in Admin → Tracking (KUECHEN_LEAD).
 * 3. Offline-Conversions „Kontakt freigeschaltet“ und „Auftrag vergeben“
 *    (Import per API, Wert = echter Umsatz, siehe conversions.ts), sekundär
 *    bis zum Umstieg auf wertbasierte Gebote.
 * 4. Kontoweites finales URL-Suffix mit UTM-Parametern (src/lib/utm.ts
 *    speichert sie an Sitzung und Lead).
 *
 * Bereits vorhandene Einstellungen, die bewusst getunt werden dürfen
 * (Lookback, Standardwert, ein anderes URL-Suffix), bleiben unangetastet.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import type { UploadKind } from "../_shared/google-ads-conversions.ts";
import {
  KW_GADS_MANAGER_ID,
  describeGoogleAdsError,
  sendToFromTagSnippets,
  type GoogleAdsClient,
} from "../_shared/google-ads.ts";

export const KITCHEN_LEAD_ACTION_NAME = "Küchenanfrage";
export const KW_FINAL_URL_SUFFIX =
  "utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}";
export const SITE_SETTINGS_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Sekundär, solange die Gebote auf Klicks bzw. Anzahl Conversions laufen:
 * sonst zählte eine mehrfach gekaufte Anfrage mehrfach. Beim Umstieg auf
 * „Conversion-Wert maximieren“ auf true setzen und „Küchenanfrage“ sekundär.
 */
const OFFLINE_ACTIONS_PRIMARY = false;

export const OFFLINE_ACTION_NAMES: Record<UploadKind, string> = {
  contact: "Kontakt freigeschaltet",
  order: "Auftrag vergeben",
};

/** Fallback, falls tracking_config keinen Wert für KUECHEN_LEAD hat (wie DEFAULT_TRACKING_CONFIG). */
const DEFAULT_KITCHEN_LEAD_VALUE = 9;

type StepStatus = "ok" | "changed" | "planned" | "differs" | "error";

export interface SetupStep {
  key: "manager_link" | "kitchen_lead_action" | "contact_action" | "order_action" | "final_url_suffix";
  status: StepStatus;
  detail: string;
}

type StepResult = Omit<SetupStep, "key">;

interface ConversionActionRow {
  resourceName?: string;
  id?: string;
  status?: string;
  type?: string;
  category?: string;
  countingType?: string;
  primaryForGoal?: boolean;
  tagSnippets?: unknown;
}

/** Durchgesetzte Einstellungen; alles andere nur beim Anlegen. */
interface EnforcedSettings {
  status: "ENABLED";
  category: string;
  countingType: string;
  primaryForGoal: boolean;
}

interface ConversionActionSpec {
  name: string;
  type: "WEBPAGE" | "UPLOAD_CLICKS";
  enforced: EnforcedSettings;
  createOnly: Record<string, unknown>;
}

const UPDATE_MASKS: Record<keyof EnforcedSettings, string> = {
  status: "status",
  category: "category",
  countingType: "counting_type",
  primaryForGoal: "primary_for_goal",
};

const DATA_DRIVEN = { attributionModel: "GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN" };

async function ensureManagerLink(client: GoogleAdsClient, dryRun: boolean): Promise<StepResult> {
  const clientId = client.customerId;
  const managerId = KW_GADS_MANAGER_ID;
  const rows = await client.search(
    `SELECT customer_manager_link.resource_name, customer_manager_link.manager_customer,
       customer_manager_link.status FROM customer_manager_link`,
    { loginCustomerId: clientId },
  );
  const link = rows
    .map((r) => r.customerManagerLink as { resourceName?: string; managerCustomer?: string; status?: string } | undefined)
    .find((l) => l?.managerCustomer === `customers/${managerId}` && (l.status === "ACTIVE" || l.status === "PENDING"));

  if (link?.status === "ACTIVE") return { status: "ok", detail: `Konto hängt unter dem Verwaltungskonto ${managerId}.` };
  if (dryRun) {
    return {
      status: "planned",
      detail: link ? "Offene Einladung des Verwaltungskontos annehmen." : "Einladung vom Verwaltungskonto senden und annehmen.",
    };
  }

  let resourceName = link?.resourceName;
  if (!resourceName) {
    const created = await client.mutate(
      "customerClientLinks",
      { operation: { create: { clientCustomer: `customers/${clientId}`, status: "PENDING" } } },
      { customerId: managerId, loginCustomerId: managerId },
    );
    const clientLink = String((created.result as { resourceName?: string } | undefined)?.resourceName ?? "");
    const linkId = clientLink.split("~")[1];
    if (!linkId) throw new Error(`Unerwartete Antwort beim Einladen: ${clientLink || "leer"}`);
    resourceName = `customers/${clientId}/customerManagerLinks/${managerId}~${linkId}`;
  }
  await client.mutate(
    "customerManagerLinks",
    { operations: [{ update: { resourceName, status: "ACTIVE" }, updateMask: "status" }] },
    { customerId: clientId, loginCustomerId: clientId },
  );
  return { status: "changed", detail: `Konto mit dem Verwaltungskonto ${managerId} verknüpft.` };
}

async function findConversionAction(client: GoogleAdsClient, name: string): Promise<ConversionActionRow | undefined> {
  const rows = await client.search(
    `SELECT conversion_action.resource_name, conversion_action.id, conversion_action.status,
       conversion_action.type, conversion_action.category, conversion_action.counting_type,
       conversion_action.primary_for_goal, conversion_action.tag_snippets
     FROM conversion_action
     WHERE conversion_action.name = '${name}' AND conversion_action.status != 'REMOVED'`,
  );
  return rows[0]?.conversionAction as ConversionActionRow | undefined;
}

async function ensureConversionAction(
  client: GoogleAdsClient,
  spec: ConversionActionSpec,
  dryRun: boolean,
): Promise<{ step: StepResult; action?: ConversionActionRow }> {
  const label = `Conversion „${spec.name}“`;
  const existing = await findConversionAction(client, spec.name);

  if (!existing) {
    await client.mutate("conversionActions", {
      operations: [{ create: { name: spec.name, type: spec.type, ...spec.enforced, ...spec.createOnly } }],
      validateOnly: dryRun,
    });
    if (dryRun) return { step: { status: "planned", detail: `${label} anlegen (von Google geprüft).` } };
    const created = await findConversionAction(client, spec.name);
    return { step: { status: "changed", detail: `${label} angelegt (ID ${created?.id ?? "?"}).` }, action: created };
  }

  if (existing.type !== spec.type) {
    throw new Error(`${label} existiert als ${existing.type}, erwartet ${spec.type}. Bitte in Google Ads prüfen.`);
  }
  const keys = Object.keys(spec.enforced) as Array<keyof EnforcedSettings>;
  const diff = keys.filter((k) => (existing[k] ?? (k === "primaryForGoal" ? false : undefined)) !== spec.enforced[k]);
  if (diff.length === 0) return { step: { status: "ok", detail: `${label} vorhanden (ID ${existing.id}).` }, action: existing };

  const update: Record<string, unknown> = { resourceName: existing.resourceName };
  for (const k of diff) update[k] = spec.enforced[k];
  await client.mutate("conversionActions", {
    operations: [{ update, updateMask: diff.map((k) => UPDATE_MASKS[k]).join(",") }],
    validateOnly: dryRun,
  });
  return {
    step: { status: dryRun ? "planned" : "changed", detail: `${label}: ${diff.join(", ")} ${dryRun ? "wird korrigiert" : "korrigiert"}.` },
    action: existing,
  };
}

async function kitchenLeadValue(sb: SupabaseClient): Promise<number> {
  const { data } = await sb.from("site_settings").select("tracking_config").eq("id", SITE_SETTINGS_ID).maybeSingle();
  const cfg = data?.tracking_config as { google_ads?: { values?: Record<string, unknown> } } | null;
  const value = Number(cfg?.google_ads?.values?.KUECHEN_LEAD);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_KITCHEN_LEAD_VALUE;
}

function offlineActionSpec(kind: UploadKind): ConversionActionSpec {
  return {
    name: OFFLINE_ACTION_NAMES[kind],
    type: "UPLOAD_CLICKS",
    // MANY_PER_CLICK: ONE_PER_CLICK lässt Google mit gbraid/wbraid (iOS) nicht zu;
    // Doppelte verhindert die Order-ID je Rechnung.
    enforced: {
      status: "ENABLED",
      category: kind === "contact" ? "QUALIFIED_LEAD" : "CONVERTED_LEAD",
      countingType: "MANY_PER_CLICK",
      primaryForGoal: OFFLINE_ACTIONS_PRIMARY,
    },
    createOnly: {
      clickThroughLookbackWindowDays: 90,
      valueSettings: { defaultValue: 1, defaultCurrencyCode: "EUR", alwaysUseDefaultValue: false },
      attributionModelSettings: DATA_DRIVEN,
    },
  };
}

async function ensureFinalUrlSuffix(client: GoogleAdsClient, dryRun: boolean): Promise<StepResult> {
  const rows = await client.search("SELECT customer.final_url_suffix FROM customer");
  const current = String((rows[0]?.customer as { finalUrlSuffix?: string } | undefined)?.finalUrlSuffix ?? "");
  if (current === KW_FINAL_URL_SUFFIX) return { status: "ok", detail: "Finales URL-Suffix ist gesetzt." };
  if (current) return { status: "differs", detail: `Anderes URL-Suffix gesetzt, nicht überschrieben: ${current}` };

  await client.mutateCustomer({
    operation: {
      update: { resourceName: `customers/${client.customerId}`, finalUrlSuffix: KW_FINAL_URL_SUFFIX },
      updateMask: "final_url_suffix",
    },
    validateOnly: dryRun,
  });
  return { status: dryRun ? "planned" : "changed", detail: `Finales URL-Suffix: ${KW_FINAL_URL_SUFFIX}` };
}

export async function runSetup(client: GoogleAdsClient, sb: SupabaseClient, dryRun: boolean) {
  const steps: SetupStep[] = [];
  let tracking: { conversionId: string; label: string } | null = null;

  const step = async (key: SetupStep["key"], run: () => Promise<StepResult>) => {
    try {
      steps.push({ key, ...(await run()) });
    } catch (err) {
      steps.push({ key, status: "error", detail: describeGoogleAdsError(err) });
    }
  };

  await step("manager_link", () => ensureManagerLink(client, dryRun));
  await step("kitchen_lead_action", async () => {
    const result = await ensureConversionAction(
      client,
      {
        name: KITCHEN_LEAD_ACTION_NAME,
        type: "WEBPAGE",
        enforced: { status: "ENABLED", category: "SUBMIT_LEAD_FORM", countingType: "ONE_PER_CLICK", primaryForGoal: true },
        createOnly: {
          clickThroughLookbackWindowDays: 90,
          viewThroughLookbackWindowDays: 1,
          valueSettings: { defaultValue: await kitchenLeadValue(sb), defaultCurrencyCode: "EUR", alwaysUseDefaultValue: false },
          attributionModelSettings: DATA_DRIVEN,
        },
      },
      dryRun,
    );
    tracking = sendToFromTagSnippets(result.action?.tagSnippets);
    return result.step;
  });
  await step("contact_action", async () => (await ensureConversionAction(client, offlineActionSpec("contact"), dryRun)).step);
  await step("order_action", async () => (await ensureConversionAction(client, offlineActionSpec("order"), dryRun)).step);
  await step("final_url_suffix", () => ensureFinalUrlSuffix(client, dryRun));

  return { ok: steps.every((s) => s.status !== "error"), dryRun, steps, tracking };
}
