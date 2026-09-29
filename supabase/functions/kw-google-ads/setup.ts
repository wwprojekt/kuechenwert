/**
 * Sollzustand des KüchenWert-Google-Ads-Kontos, wiederholbar:
 * 1. Konto hängt unter dem Verwaltungskonto (Einladung + Annahme per API).
 * 2. Webseiten-Conversion „Küchenanfrage“ (Lead-Formular, eine pro Klick,
 *    primär). Ihr send_to gehört in Admin → Tracking (KUECHEN_LEAD).
 * 3. Kontoweites finales URL-Suffix mit UTM-Parametern (src/lib/utm.ts
 *    speichert sie an Sitzung und Lead).
 *
 * Bereits vorhandene Einstellungen, die bewusst getunt werden dürfen
 * (Lookback, Standardwert, ein anderes URL-Suffix), bleiben unangetastet.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
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

/** Fallback, falls tracking_config keinen Wert für KUECHEN_LEAD hat (wie DEFAULT_TRACKING_CONFIG). */
const DEFAULT_KITCHEN_LEAD_VALUE = 9;

type StepStatus = "ok" | "changed" | "planned" | "differs" | "error";

export interface SetupStep {
  key: "manager_link" | "kitchen_lead_action" | "final_url_suffix";
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

async function findKitchenLeadAction(client: GoogleAdsClient): Promise<ConversionActionRow | undefined> {
  const rows = await client.search(
    `SELECT conversion_action.resource_name, conversion_action.id, conversion_action.status,
       conversion_action.type, conversion_action.category, conversion_action.counting_type,
       conversion_action.primary_for_goal, conversion_action.tag_snippets
     FROM conversion_action
     WHERE conversion_action.name = '${KITCHEN_LEAD_ACTION_NAME}' AND conversion_action.status != 'REMOVED'`,
  );
  return rows[0]?.conversionAction as ConversionActionRow | undefined;
}

async function kitchenLeadValue(sb: SupabaseClient): Promise<number> {
  const { data } = await sb.from("site_settings").select("tracking_config").eq("id", SITE_SETTINGS_ID).maybeSingle();
  const cfg = data?.tracking_config as { google_ads?: { values?: Record<string, unknown> } } | null;
  const value = Number(cfg?.google_ads?.values?.KUECHEN_LEAD);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_KITCHEN_LEAD_VALUE;
}

const REQUIRED_ACTION_SETTINGS = {
  status: "ENABLED",
  category: "SUBMIT_LEAD_FORM",
  countingType: "ONE_PER_CLICK",
  primaryForGoal: true,
} as const;

const UPDATE_MASKS: Record<keyof typeof REQUIRED_ACTION_SETTINGS, string> = {
  status: "status",
  category: "category",
  countingType: "counting_type",
  primaryForGoal: "primary_for_goal",
};

async function ensureKitchenLeadAction(
  client: GoogleAdsClient,
  sb: SupabaseClient,
  dryRun: boolean,
): Promise<{ step: StepResult; sendTo: { conversionId: string; label: string } | null }> {
  const existing = await findKitchenLeadAction(client);

  if (!existing) {
    await client.mutate("conversionActions", {
      operations: [
        {
          create: {
            name: KITCHEN_LEAD_ACTION_NAME,
            type: "WEBPAGE",
            ...REQUIRED_ACTION_SETTINGS,
            clickThroughLookbackWindowDays: 90,
            viewThroughLookbackWindowDays: 1,
            valueSettings: {
              defaultValue: await kitchenLeadValue(sb),
              defaultCurrencyCode: "EUR",
              alwaysUseDefaultValue: false,
            },
            attributionModelSettings: { attributionModel: "GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN" },
          },
        },
      ],
      validateOnly: dryRun,
    });
    if (dryRun) {
      return { step: { status: "planned", detail: `Conversion „${KITCHEN_LEAD_ACTION_NAME}“ anlegen (von Google geprüft).` }, sendTo: null };
    }
    const created = await findKitchenLeadAction(client);
    return {
      step: { status: "changed", detail: `Conversion „${KITCHEN_LEAD_ACTION_NAME}“ angelegt (ID ${created?.id ?? "?"}).` },
      sendTo: sendToFromTagSnippets(created?.tagSnippets),
    };
  }

  if (existing.type !== "WEBPAGE") {
    throw new Error(`„${KITCHEN_LEAD_ACTION_NAME}“ existiert als ${existing.type}, erwartet WEBPAGE. Bitte in Google Ads prüfen.`);
  }
  const sendTo = sendToFromTagSnippets(existing.tagSnippets);
  const keys = Object.keys(REQUIRED_ACTION_SETTINGS) as Array<keyof typeof REQUIRED_ACTION_SETTINGS>;
  const diff = keys.filter((k) => existing[k] !== REQUIRED_ACTION_SETTINGS[k]);
  if (diff.length === 0) {
    return { step: { status: "ok", detail: `Conversion „${KITCHEN_LEAD_ACTION_NAME}“ vorhanden (ID ${existing.id}).` }, sendTo };
  }

  const update: Record<string, unknown> = { resourceName: existing.resourceName };
  for (const k of diff) update[k] = REQUIRED_ACTION_SETTINGS[k];
  await client.mutate("conversionActions", {
    operations: [{ update, updateMask: diff.map((k) => UPDATE_MASKS[k]).join(",") }],
    validateOnly: dryRun,
  });
  return {
    step: {
      status: dryRun ? "planned" : "changed",
      detail: `Conversion „${KITCHEN_LEAD_ACTION_NAME}“: ${diff.join(", ")} ${dryRun ? "wird korrigiert" : "korrigiert"}.`,
    },
    sendTo,
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
    const result = await ensureKitchenLeadAction(client, sb, dryRun);
    tracking = result.sendTo;
    return result.step;
  });
  await step("final_url_suffix", () => ensureFinalUrlSuffix(client, dryRun));

  return { ok: steps.every((s) => s.status !== "error"), dryRun, steps, tracking };
}
