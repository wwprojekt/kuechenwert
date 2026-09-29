/**
 * Diagnose für Admin → Tracking: Herkunft der Zugangsdaten (nie Werte), Konto,
 * Verknüpfung mit dem Verwaltungskonto, Conversion-Aktionen und ob die in
 * tracking_config eingetragene Conversion zu „Küchenanfrage“ passt.
 * Fehler kommen als { ok: false, error } mit HTTP 200, damit die UI sie zeigt.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  GADS_API_VERSION,
  KW_GADS_MANAGER_ID,
  createGoogleAdsClient,
  describeGoogleAdsError,
  loadGoogleAdsCredentials,
  sendToFromTagSnippets,
} from "../_shared/google-ads.ts";
import { KITCHEN_LEAD_ACTION_NAME, KW_FINAL_URL_SUFFIX, SITE_SETTINGS_ID } from "./setup.ts";

const CUSTOMER_QUERY = `SELECT customer.id, customer.descriptive_name, customer.currency_code,
  customer.time_zone, customer.status, customer.test_account, customer.auto_tagging_enabled,
  customer.final_url_suffix, customer.conversion_tracking_setting.conversion_tracking_id,
  customer.conversion_tracking_setting.accepted_customer_data_terms,
  customer.conversion_tracking_setting.enhanced_conversions_for_leads_enabled
  FROM customer`;

const MANAGER_LINKS_QUERY = `SELECT customer_manager_link.manager_customer, customer_manager_link.status
  FROM customer_manager_link`;

const CONVERSION_ACTIONS_QUERY = `SELECT conversion_action.id, conversion_action.name,
  conversion_action.status, conversion_action.type, conversion_action.category,
  conversion_action.counting_type, conversion_action.primary_for_goal, conversion_action.tag_snippets
  FROM conversion_action WHERE conversion_action.status != 'REMOVED' ORDER BY conversion_action.id`;

async function loadKitchenLeadTracking(sb: SupabaseClient) {
  const { data } = await sb.from("site_settings").select("tracking_config").eq("id", SITE_SETTINGS_ID).maybeSingle();
  const cfg = (data?.tracking_config ?? {}) as {
    enabled?: boolean;
    google_ads?: { enabled?: boolean; conversion_id?: string; labels?: Record<string, string> };
  };
  const conversionId = String(cfg.google_ads?.conversion_id ?? "").trim();
  const label = String(cfg.google_ads?.labels?.KUECHEN_LEAD ?? "").trim();
  return {
    enabled: cfg.enabled !== false && cfg.google_ads?.enabled === true,
    configured: conversionId && label ? `${conversionId}/${label}` : null,
  };
}

export async function runStatus(sb: SupabaseClient) {
  const { sources, credentials } = await loadGoogleAdsCredentials();
  const base = { apiVersion: GADS_API_VERSION, managerId: KW_GADS_MANAGER_ID, credentials: sources };
  if (!credentials) {
    const missing = Object.entries(sources).filter(([, s]) => s === "missing").map(([k]) => `gads_${k}`);
    return { ...base, ok: false, error: `Zugangsdaten unvollständig, im Vault fehlt: ${missing.join(", ")}` };
  }

  const client = createGoogleAdsClient(credentials);
  const ids = { customerId: client.customerId, loginCustomerId: client.loginCustomerId };
  try {
    const customerRows = await client.search(CUSTOMER_QUERY);
    const [linkRows, actionRows, tracking] = await Promise.all([
      client.search(MANAGER_LINKS_QUERY),
      client.search(CONVERSION_ACTIONS_QUERY),
      loadKitchenLeadTracking(sb),
    ]);

    const c = (customerRows[0]?.customer ?? {}) as Record<string, unknown>;
    const cts = (c.conversionTrackingSetting ?? {}) as Record<string, unknown>;
    const conversionActions = actionRows.map((r) => {
      const a = (r.conversionAction ?? {}) as Record<string, unknown>;
      const sendTo = sendToFromTagSnippets(a.tagSnippets);
      return {
        id: String(a.id ?? ""),
        name: String(a.name ?? ""),
        status: String(a.status ?? ""),
        type: String(a.type ?? ""),
        category: String(a.category ?? ""),
        countingType: String(a.countingType ?? ""),
        primaryForGoal: a.primaryForGoal === true,
        sendTo: sendTo ? `${sendTo.conversionId}/${sendTo.label}` : null,
      };
    });
    const expected = conversionActions.find((a) => a.name === KITCHEN_LEAD_ACTION_NAME)?.sendTo ?? null;

    return {
      ...base,
      ...ids,
      ok: true,
      account: {
        id: String(c.id ?? ""),
        name: String(c.descriptiveName ?? ""),
        currencyCode: String(c.currencyCode ?? ""),
        timeZone: String(c.timeZone ?? ""),
        status: String(c.status ?? ""),
        testAccount: c.testAccount === true,
        autoTagging: c.autoTaggingEnabled === true,
        finalUrlSuffix: String(c.finalUrlSuffix ?? ""),
        finalUrlSuffixOk: c.finalUrlSuffix === KW_FINAL_URL_SUFFIX,
        conversionTrackingId: cts.conversionTrackingId ? `AW-${cts.conversionTrackingId}` : null,
        acceptedCustomerDataTerms: cts.acceptedCustomerDataTerms === true,
        enhancedConversionsForLeads: cts.enhancedConversionsForLeadsEnabled === true,
      },
      managerLinks: linkRows.map((r) => {
        const l = (r.customerManagerLink ?? {}) as { managerCustomer?: string; status?: string };
        return { managerId: String(l.managerCustomer ?? "").replace(/\D/g, ""), status: String(l.status ?? "") };
      }),
      conversionActions,
      tracking: { ...tracking, expected, matches: expected !== null && tracking.configured === expected },
    };
  } catch (err) {
    return { ...base, ...ids, ok: false, error: describeGoogleAdsError(err) };
  }
}
