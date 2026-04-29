/**
 * bing-ads-campaign-fix
 * ─────────────────────
 * Verwaltet importierte Bing-Ads-Kampagnen via Microsoft Advertising
 * Campaign Management REST API v13. Wurde gebaut, um die fehlerhaft aus
 * Google Ads importierte Kampagne autonom (ohne UI-Klicks) zu reparieren.
 *
 * Long-term reusable: jede Korrektur ist eine eigene Action, sodass die
 * Funktion auch künftig für Bulk-Edits oder Migration wiederverwendbar ist.
 *
 * Endpoints (Microsoft Learn, REST tab):
 *  - POST  /Campaigns/QueryByAccountId  → list campaigns
 *  - POST  /AdGroups/QueryByCampaignId  → list ad groups
 *  - PUT   /Campaigns                   → update campaign(s)
 *  - PUT   /AdGroups                    → update ad group(s)
 *
 * Auth-Header (alle Calls):
 *   Authorization:    Bearer <access-token>   ← via _shared/bing-oauth-token
 *   DeveloperToken:   <BING_DEVELOPER_TOKEN>
 *   CustomerId:       <BING_CUSTOMER_ID>
 *   CustomerAccountId:<BING_CUSTOMER_ACCOUNT_ID>
 *
 * Aktionen (POST body):
 *   { "action": "audit" }
 *      → liest alle Campaigns + AdGroups, returned reines JSON. Keine Writes.
 *
 *   { "action": "apply-fixes",
 *     "campaign_id": "<optional, sonst auto-detect wenn nur 1>",
 *     "fixes": {
 *        "clear_adgroup_end_dates": true,
 *        "set_tracking_template":   true,
 *        "disable_audience_network":true,
 *        "clear_custom_parameters": true,
 *        "set_daily_budget":        500,           // EUR pro Tag, 0/false = skip
 *        "remove_ad_schedule":      true           // 24/7 statt Blackout
 *     },
 *     "dry_run": false
 *   }
 *      → führt jede aktivierte Fix-Aktion aus und returnt einen Pro-Fix-Report.
 *
 * Fehler-Strategie:
 *   - Jede Fix-Aktion ist isoliert in try/catch. Ein Fehler stoppt den
 *     Gesamtdurchlauf NICHT, sondern wird im Report markiert.
 *   - Partial-Errors (Bing-API-spezifisch) werden separat ausgewertet
 *     und im Report gelistet.
 *
 * Auth zur Edge Function selbst: verify_jwt = true (admin-only). Die
 * Function ist nicht für Browser-Aufrufe konzipiert, nur für gezielte
 * Admin-Wartungsaufgaben.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getBingAccessToken } from '../_shared/bing-oauth-token.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

const BING_API_BASE =
  'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13';

interface BingHeaders {
  developerToken: string;
  customerId: string;
  customerAccountId: string;
  accessToken: string;
}

function buildHeaders(h: BingHeaders): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${h.accessToken}`,
    DeveloperToken: h.developerToken,
    CustomerId: h.customerId,
    CustomerAccountId: h.customerAccountId,
  };
}

/**
 * Wrapper für Bing-REST-Calls mit einheitlichem Logging + Error-Handling.
 * Wirft bei HTTP != 2xx mit voll zitiertem Body, damit Reports
 * den Microsoft-Fehlertext sichtbar machen.
 */
async function bingFetch(
  url: string,
  init: RequestInit,
  label: string,
): Promise<any> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* nicht-JSON-Antwort durchreichen */
  }
  if (!resp.ok) {
    throw new Error(
      `[${label}] Bing API HTTP ${resp.status}: ${text.slice(0, 1000)}`,
    );
  }
  return json;
}

/**
 * Listet Campaigns im Account. CampaignType "All" wäre praktisch, aber
 * Bing erfordert genaue Werte – wir senden alle Search-Typen, das deckt
 * importierte Google-Kampagnen ab.
 */
async function getCampaigns(headers: BingHeaders, accountId: string) {
  // CampaignType in REST = single enum value or space-list ("Search Shopping").
  // Die importierte Google-Ads-Kampagne ist eine Search-Kampagne — andere
  // Typen sind im Account nicht vorhanden, also reicht "Search".
  //
  // ReturnAdditionalFields darf NUR gültige Werte aus dem
  // CampaignAdditionalField-Enum enthalten (siehe MS Learn). Felder wie
  // TrackingUrlTemplate, FinalUrlSuffix, UrlCustomParameters, Settings,
  // BiddingScheme werden bereits standardmäßig zurückgegeben — sie hier
  // mit aufzunehmen produziert HTTP 400 ($.ReturnAdditionalFields).
  return await bingFetch(
    `${BING_API_BASE}/Campaigns/QueryByAccountId`,
    {
      method: 'POST',
      headers: buildHeaders(headers),
      body: JSON.stringify({
        AccountId: accountId,
        CampaignType: 'Search',
        ReturnAdditionalFields: 'BidStrategyId',
      }),
    },
    'GetCampaignsByAccountId',
  );
}

async function getAdGroups(headers: BingHeaders, campaignId: string) {
  return await bingFetch(
    `${BING_API_BASE}/AdGroups/QueryByCampaignId`,
    {
      method: 'POST',
      headers: buildHeaders(headers),
      body: JSON.stringify({
        CampaignId: campaignId,
        ReturnAdditionalFields: 'MultimediaAdsBidAdjustment',
      }),
    },
    'GetAdGroupsByCampaignId',
  );
}

async function getKeywords(headers: BingHeaders, adGroupId: string) {
  // KeywordEditorialStatus + ReturnAdditionalFields müssen weggelassen
  // werden wenn nicht gesetzt — null führt zu HTTP 400 NullRequest.
  return await bingFetch(
    `${BING_API_BASE}/Keywords/QueryByAdGroupId`,
    {
      method: 'POST',
      headers: buildHeaders(headers),
      body: JSON.stringify({ AdGroupId: adGroupId }),
    },
    'GetKeywordsByAdGroupId',
  );
}

async function getAds(headers: BingHeaders, adGroupId: string) {
  return await bingFetch(
    `${BING_API_BASE}/Ads/QueryByAdGroupId`,
    {
      method: 'POST',
      headers: buildHeaders(headers),
      body: JSON.stringify({
        AdGroupId: adGroupId,
        AdTypes: ['ResponsiveSearch', 'ExpandedText', 'DynamicSearch', 'ResponsiveAd', 'AppInstall'],
      }),
    },
    'GetAdsByAdGroupId',
  );
}

/**
 * Holt Campaign-Level Negative Keywords und gibt sie als FLACHES
 * Array zurück. Bing-Response-Shape ist EntityNegativeKeywords[].NegativeKeywords[].
 */
async function getNegativeKeywords(
  headers: BingHeaders,
  campaignId: string,
): Promise<Array<{ Text: string; MatchType: string; Id?: string | number }>> {
  const resp = await bingFetch(
    `${BING_API_BASE}/NegativeKeywords/QueryByEntityIds`,
    {
      method: 'POST',
      headers: buildHeaders(headers),
      body: JSON.stringify({
        EntityIds: [campaignId],
        EntityType: 'Campaign',
      }),
    },
    'GetNegativeKeywordsByEntityIds',
  );
  const buckets: any[] = Array.isArray(resp?.EntityNegativeKeywords)
    ? resp.EntityNegativeKeywords
    : [];
  const flat: any[] = [];
  for (const b of buckets) {
    const items = b?.NegativeKeywords;
    if (Array.isArray(items)) flat.push(...items);
  }
  return flat;
}

/**
 * Microsoft REST: GetCampaignCriterionsByIds erlaubt NUR EINEN
 * CriterionType pro Call. Wir feuern alle relevanten Typen parallel ab
 * und konsolidieren die Ergebnisse.
 */
// Audience + RadiusSearch werden vom Standard-Dev-Token-Tier abgelehnt.
// Wenn wir die später brauchen → eigener Tier-Upgrade-Antrag bei Microsoft.
const CRITERION_TYPES = [
  'Location',
  'LocationIntent',
  'DayTime',
  'Device',
  'Age',
  'Gender',
] as const;

async function getCampaignCriterions(
  headers: BingHeaders,
  campaignId: string,
): Promise<{ criterions: any[]; errorsByType: Record<string, string> }> {
  const errorsByType: Record<string, string> = {};
  const all: any[] = [];
  await Promise.all(
    CRITERION_TYPES.map(async (type) => {
      try {
        const resp = await bingFetch(
          `${BING_API_BASE}/CampaignCriterions/QueryByIds`,
          {
            method: 'POST',
            headers: buildHeaders(headers),
            body: JSON.stringify({
              CampaignId: campaignId,
              CriterionType: type,
            }),
          },
          `GetCampaignCriterionsByIds[${type}]`,
        );
        const items: any[] = Array.isArray(resp?.CampaignCriterions)
          ? resp.CampaignCriterions
          : [];
        all.push(...items);
      } catch (e: any) {
        errorsByType[type] = e?.message ?? String(e);
      }
    }),
  );
  return { criterions: all, errorsByType };
}

/**
 * Adds Campaign-level Negative Keywords. Idempotent: holt erst bestehende,
 * filtert Duplikate raus, schickt nur die neuen.
 *
 * Endpoint: POST /NegativeKeywords  (AddNegativeKeywordsToCampaigns).
 */
async function addCampaignNegativeKeywords(
  headers: BingHeaders,
  campaignId: string,
  keywords: Array<{ text: string; matchType: 'Phrase' | 'Exact' }>,
) {
  // REST endpoint is /EntityNegativeKeywords (operation name AddNegativeKeywordsToEntities).
  // Entity-level NegativeKeyword does NOT carry a `Type` field — that exists only on
  // shared-list items. Adding it returns HTTP 404 from the bingads gateway.
  const negKws = keywords.map((k) => ({
    Text: k.text,
    MatchType: k.matchType,
  }));
  return await bingFetch(
    `${BING_API_BASE}/EntityNegativeKeywords`,
    {
      method: 'POST',
      headers: buildHeaders(headers),
      body: JSON.stringify({
        EntityNegativeKeywords: [
          {
            EntityId: campaignId,
            EntityType: 'Campaign',
            NegativeKeywords: negKws,
          },
        ],
      }),
    },
    'AddNegativeKeywordsToEntities',
  );
}

interface AdGroupPatch {
  Id: string | number;
  // Alle weiteren Felder sind optional – Bing macht ein partial-update,
  // d. h. nur explizit übergebene Felder werden geändert. EXPLICIT NULL
  // löscht den Wert (z. B. EndDate=null entfernt das Enddatum).
  EndDate?: { Day: number; Month: number; Year: number } | null;
  MultimediaAdsBidAdjustment?: number;
  Status?: string;
  [k: string]: unknown;
}

async function updateAdGroups(
  headers: BingHeaders,
  campaignId: string,
  adGroups: AdGroupPatch[],
  updateAudienceAdsBidAdjustment = false,
) {
  return await bingFetch(
    `${BING_API_BASE}/AdGroups`,
    {
      method: 'PUT',
      headers: buildHeaders(headers),
      body: JSON.stringify({
        CampaignId: campaignId,
        AdGroups: adGroups,
        UpdateAudienceAdsBidAdjustment: updateAudienceAdsBidAdjustment,
      }),
    },
    'UpdateAdGroups',
  );
}

interface CampaignPatch {
  Id: string | number;
  TrackingUrlTemplate?: string | null;
  FinalUrlSuffix?: string | null;
  UrlCustomParameters?: { Parameters: Array<{ Key: string; Value: string }> } | null;
  DailyBudget?: number;
  [k: string]: unknown;
}

async function updateCampaigns(
  headers: BingHeaders,
  accountId: string,
  campaigns: CampaignPatch[],
) {
  return await bingFetch(
    `${BING_API_BASE}/Campaigns`,
    {
      method: 'PUT',
      headers: buildHeaders(headers),
      body: JSON.stringify({
        AccountId: accountId,
        Campaigns: campaigns,
      }),
    },
    'UpdateCampaigns',
  );
}

/**
 * Aus PartialErrors[] eine kompakte, lesbare Zusammenfassung machen.
 * Bing returnt 2xx auch wenn 1 von N Items fehlgeschlagen ist – wir
 * müssen das aktiv in einen Misserfolg umdeuten.
 */
function summarizePartialErrors(resp: any): string | null {
  const partials = resp?.PartialErrors;
  if (!Array.isArray(partials) || partials.length === 0) return null;
  return partials
    .map((p: any, i: number) => {
      const code = p.ErrorCode ?? p.Code ?? 'UnknownError';
      const msg = p.Message ?? p.ErrorMessage ?? '';
      const idx = p.Index ?? p.FieldPath ?? i;
      return `#${idx} ${code}: ${msg}`;
    })
    .join(' | ');
}

interface FixesConfig {
  clear_adgroup_end_dates?: boolean;
  set_tracking_template?: boolean;
  disable_audience_network?: boolean;
  clear_custom_parameters?: boolean;
  set_daily_budget?: number;
  remove_ad_schedule?: boolean;
}

interface FixResult {
  fix: string;
  applied: boolean;
  skipped?: boolean;
  dry_run?: boolean;
  affected?: number;
  error?: string;
  details?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest(req);
  const cors = getCorsHeaders(req);

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body, null, 2), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  // --- Body parsen ---
  let body: any = {};
  try {
    body = req.method === 'POST' ? await req.json() : {};
  } catch {
    return json(400, { error: 'invalid_json_body' });
  }
  const action = (body.action as string) ?? 'audit';

  // --- Credentials prüfen ---
  const developerToken = Deno.env.get('BING_DEVELOPER_TOKEN');
  const customerId = Deno.env.get('BING_CUSTOMER_ID');
  const customerAccountId = Deno.env.get('BING_CUSTOMER_ACCOUNT_ID');
  const oauthClientId = Deno.env.get('BING_OAUTH_CLIENT_ID');
  const oauthClientSecret = Deno.env.get('BING_OAUTH_CLIENT_SECRET');
  const oauthRefreshToken = Deno.env.get('BING_OAUTH_REFRESH_TOKEN');

  if (
    !developerToken ||
    !customerId ||
    !customerAccountId ||
    !oauthClientId ||
    !oauthClientSecret ||
    !oauthRefreshToken
  ) {
    return json(500, {
      error: 'missing_credentials',
      missing: {
        BING_DEVELOPER_TOKEN: !developerToken,
        BING_CUSTOMER_ID: !customerId,
        BING_CUSTOMER_ACCOUNT_ID: !customerAccountId,
        BING_OAUTH_CLIENT_ID: !oauthClientId,
        BING_OAUTH_CLIENT_SECRET: !oauthClientSecret,
        BING_OAUTH_REFRESH_TOKEN: !oauthRefreshToken,
      },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- Access-Token holen (mit Refresh-Token-Rotation + Lease-Lock) ---
  let accessToken: string;
  try {
    const r = await getBingAccessToken(supabase, {
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      initialRefreshToken: oauthRefreshToken,
    });
    accessToken = r.accessToken;
  } catch (err: any) {
    return json(500, {
      error: 'oauth_refresh_failed',
      message: err?.message ?? String(err),
    });
  }

  const headers: BingHeaders = {
    developerToken,
    customerId,
    customerAccountId,
    accessToken,
  };

  // ─────────────────────────────────────────────────────────────
  // ACTION: audit (read-only)
  // ─────────────────────────────────────────────────────────────
  if (action === 'audit') {
    try {
      const campaignsResp = await getCampaigns(headers, customerAccountId);
      const campaigns = campaignsResp?.Campaigns ?? [];

      const enriched = await Promise.all(
        campaigns.map(async (c: any) => {
          let adGroups: any[] = [];
          let adGroupErr: string | undefined;
          try {
            const ag = await getAdGroups(headers, String(c.Id));
            adGroups = ag?.AdGroups ?? [];
          } catch (e: any) {
            adGroupErr = e?.message ?? String(e);
          }
          return {
            id: c.Id,
            name: c.Name,
            status: c.Status,
            daily_budget: c.DailyBudget,
            time_zone: c.TimeZone,
            tracking_url_template: c.TrackingUrlTemplate ?? null,
            final_url_suffix: c.FinalUrlSuffix ?? null,
            url_custom_parameters: c.UrlCustomParameters ?? null,
            bidding_scheme_type: c.BiddingScheme?.Type,
            settings: c.Settings,
            ad_group_count: adGroups.length,
            ad_groups: adGroups.map((a: any) => ({
              id: a.Id,
              name: a.Name,
              status: a.Status,
              end_date: a.EndDate,
              start_date: a.StartDate,
              tracking_url_template: a.TrackingUrlTemplate ?? null,
              final_url_suffix: a.FinalUrlSuffix ?? null,
              multimedia_ads_bid_adjustment: a.MultimediaAdsBidAdjustment,
              audience_ads_bid_adjustment: a.AudienceAdsBidAdjustment,
            })),
            ad_group_query_error: adGroupErr,
          };
        }),
      );

      return json(200, {
        ok: true,
        account_id: customerAccountId,
        campaign_count: enriched.length,
        campaigns: enriched,
      });
    } catch (err: any) {
      return json(500, {
        error: 'audit_failed',
        message: err?.message ?? String(err),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ACTION: apply-fixes
  // ─────────────────────────────────────────────────────────────
  if (action === 'apply-fixes') {
    const fixes: FixesConfig = body.fixes ?? {};
    const dryRun = !!body.dry_run;
    const trackingTemplate =
      typeof body.tracking_template === 'string'
        ? body.tracking_template
        : '{lpurl}?msclkid={msclkid}';
    const finalUrlSuffix =
      typeof body.final_url_suffix === 'string'
        ? body.final_url_suffix
        : 'utm_source=bing&utm_medium=cpc&utm_campaign={CampaignId}&utm_content={AdId}&utm_term={keyword}&msclkid={msclkid}';

    // 1) Campaign auswählen
    let campaignId: string | null = body.campaign_id ?? null;
    let campaign: any = null;
    let allCampaigns: any[] = [];
    try {
      const campaignsResp = await getCampaigns(headers, customerAccountId);
      allCampaigns = campaignsResp?.Campaigns ?? [];
      if (!campaignId) {
        if (allCampaigns.length === 1) {
          campaignId = String(allCampaigns[0].Id);
        } else if (allCampaigns.length > 1) {
          return json(400, {
            error: 'multiple_campaigns_pass_campaign_id',
            campaigns: allCampaigns.map((c) => ({ id: c.Id, name: c.Name })),
          });
        } else {
          return json(404, { error: 'no_campaigns_in_account' });
        }
      }
      campaign = allCampaigns.find((c) => String(c.Id) === String(campaignId));
      if (!campaign) {
        return json(404, {
          error: 'campaign_not_found',
          requested: campaignId,
          available: allCampaigns.map((c) => ({ id: c.Id, name: c.Name })),
        });
      }
    } catch (err: any) {
      return json(500, {
        error: 'campaign_lookup_failed',
        message: err?.message ?? String(err),
      });
    }

    // 2) AdGroups laden (für Pre-Image, Affected-Count, Validation)
    let adGroups: any[] = [];
    try {
      const ag = await getAdGroups(headers, campaignId!);
      adGroups = ag?.AdGroups ?? [];
    } catch (err: any) {
      return json(500, {
        error: 'adgroup_lookup_failed',
        message: err?.message ?? String(err),
      });
    }

    const results: FixResult[] = [];

    // ───── FIX 1: Clear AdGroup End Dates ─────
    if (fixes.clear_adgroup_end_dates) {
      const candidates = adGroups.filter((a) => a.EndDate);
      if (candidates.length === 0) {
        results.push({
          fix: 'clear_adgroup_end_dates',
          applied: true,
          skipped: true,
          affected: 0,
          details: 'no_adgroups_with_end_date',
        });
      } else if (dryRun) {
        results.push({
          fix: 'clear_adgroup_end_dates',
          applied: false,
          dry_run: true,
          affected: candidates.length,
          details: candidates.map((a) => ({ id: a.Id, name: a.Name, end_date: a.EndDate })),
        });
      } else {
        try {
          // Bing erlaubt max 1000 AdGroups pro Update-Call — wir haben 10, also 1 Call.
          const patch: AdGroupPatch[] = candidates.map((a) => ({
            Id: a.Id,
            EndDate: null,
          }));
          const resp = await updateAdGroups(headers, campaignId!, patch);
          const partialErr = summarizePartialErrors(resp);
          results.push({
            fix: 'clear_adgroup_end_dates',
            applied: !partialErr,
            affected: candidates.length,
            error: partialErr ?? undefined,
          });
        } catch (err: any) {
          results.push({
            fix: 'clear_adgroup_end_dates',
            applied: false,
            error: err?.message ?? String(err),
          });
        }
      }
    }

    // ───── FIX 2: Set Tracking Template + Final URL Suffix on Campaign ─────
    if (fixes.set_tracking_template) {
      if (dryRun) {
        results.push({
          fix: 'set_tracking_template',
          applied: false,
          dry_run: true,
          details: {
            tracking_template: trackingTemplate,
            final_url_suffix: finalUrlSuffix,
            previous: {
              tracking_template: campaign.TrackingUrlTemplate ?? null,
              final_url_suffix: campaign.FinalUrlSuffix ?? null,
            },
          },
        });
      } else {
        try {
          const patch: CampaignPatch[] = [
            {
              Id: campaign.Id,
              TrackingUrlTemplate: trackingTemplate,
              FinalUrlSuffix: finalUrlSuffix,
            },
          ];
          const resp = await updateCampaigns(headers, customerAccountId, patch);
          const partialErr = summarizePartialErrors(resp);
          results.push({
            fix: 'set_tracking_template',
            applied: !partialErr,
            error: partialErr ?? undefined,
            details: { tracking_template: trackingTemplate, final_url_suffix: finalUrlSuffix },
          });
        } catch (err: any) {
          results.push({
            fix: 'set_tracking_template',
            applied: false,
            error: err?.message ?? String(err),
          });
        }
      }
    }

    // ───── FIX 3: Disable Audience Network (MAN bid -100% on all AdGroups) ─────
    // MultimediaAdsBidAdjustment kann -100..900 sein. -100 = effektiv abgeschaltet.
    // Wir setzen es zusätzlich auf AudienceAdsBidAdjustment, da Bing zwischen
    // den beiden differenziert (Multimedia = Bilder/Video, Audience = MAN).
    if (fixes.disable_audience_network) {
      if (dryRun) {
        results.push({
          fix: 'disable_audience_network',
          applied: false,
          dry_run: true,
          affected: adGroups.length,
          details: 'set_multimedia_and_audience_bid_to_-100_on_all_adgroups',
        });
      } else {
        try {
          const patch: AdGroupPatch[] = adGroups.map((a) => ({
            Id: a.Id,
            MultimediaAdsBidAdjustment: -100,
            AudienceAdsBidAdjustment: -100,
          }));
          const resp = await updateAdGroups(headers, campaignId!, patch, true);
          const partialErr = summarizePartialErrors(resp);
          results.push({
            fix: 'disable_audience_network',
            applied: !partialErr,
            affected: adGroups.length,
            error: partialErr ?? undefined,
          });
        } catch (err: any) {
          results.push({
            fix: 'disable_audience_network',
            applied: false,
            error: err?.message ?? String(err),
          });
        }
      }
    }

    // ───── FIX 4: Clear Custom Parameters on Campaign ─────
    // Beim Import wurde "Test/Test" als Custom Parameter gesetzt — kein
    // produktiver Use-Case, also leeren.
    if (fixes.clear_custom_parameters) {
      if (dryRun) {
        results.push({
          fix: 'clear_custom_parameters',
          applied: false,
          dry_run: true,
          details: { previous: campaign.UrlCustomParameters ?? null },
        });
      } else {
        try {
          const patch: CampaignPatch[] = [
            {
              Id: campaign.Id,
              UrlCustomParameters: { Parameters: [] },
            },
          ];
          const resp = await updateCampaigns(headers, customerAccountId, patch);
          const partialErr = summarizePartialErrors(resp);
          results.push({
            fix: 'clear_custom_parameters',
            applied: !partialErr,
            error: partialErr ?? undefined,
          });
        } catch (err: any) {
          results.push({
            fix: 'clear_custom_parameters',
            applied: false,
            error: err?.message ?? String(err),
          });
        }
      }
    }

    // ───── FIX 5: Set Daily Budget ─────
    if (
      typeof fixes.set_daily_budget === 'number' &&
      fixes.set_daily_budget > 0
    ) {
      const newBudget = Number(fixes.set_daily_budget);
      if (dryRun) {
        results.push({
          fix: 'set_daily_budget',
          applied: false,
          dry_run: true,
          details: {
            new_budget: newBudget,
            previous: campaign.DailyBudget,
          },
        });
      } else if (
        typeof campaign.DailyBudget === 'number' &&
        Math.abs(campaign.DailyBudget - newBudget) < 0.01
      ) {
        results.push({
          fix: 'set_daily_budget',
          applied: true,
          skipped: true,
          details: { current: campaign.DailyBudget, requested: newBudget },
        });
      } else {
        try {
          const patch: CampaignPatch[] = [
            {
              Id: campaign.Id,
              DailyBudget: newBudget,
            },
          ];
          const resp = await updateCampaigns(headers, customerAccountId, patch);
          const partialErr = summarizePartialErrors(resp);
          results.push({
            fix: 'set_daily_budget',
            applied: !partialErr,
            error: partialErr ?? undefined,
            details: { previous: campaign.DailyBudget, new: newBudget },
          });
        } catch (err: any) {
          results.push({
            fix: 'set_daily_budget',
            applied: false,
            error: err?.message ?? String(err),
          });
        }
      }
    }

    // ───── FIX 6: Remove Ad Schedule (24/7) ─────
    // AdSchedule liegt auf Kampagnen-Ebene als "TargetCriterion" und ist
    // separat von Update-Campaigns. Wir signalisieren hier nur einen
    // "manual_required" Hinweis, weil der saubere API-Weg über
    // CampaignCriterions geht — das wird ein dediziertes Folge-Feature,
    // weil es einen extra Endpoint braucht (DeleteAdGroupCriterions /
    // CampaignCriterions/DeleteByIds).
    if (fixes.remove_ad_schedule) {
      results.push({
        fix: 'remove_ad_schedule',
        applied: false,
        skipped: true,
        details:
          'requires_separate_endpoint_CampaignCriterionService/DeleteCampaignCriterions — not yet wired up',
      });
    }

    // 3) Re-Audit zum Verifizieren
    let postAudit: any = null;
    if (!dryRun) {
      try {
        const ag2 = await getAdGroups(headers, campaignId!);
        const c2 = await getCampaigns(headers, customerAccountId);
        const c2Match = (c2?.Campaigns ?? []).find(
          (c: any) => String(c.Id) === String(campaignId),
        );
        postAudit = {
          campaign_after: {
            id: c2Match?.Id,
            name: c2Match?.Name,
            daily_budget: c2Match?.DailyBudget,
            tracking_url_template: c2Match?.TrackingUrlTemplate ?? null,
            final_url_suffix: c2Match?.FinalUrlSuffix ?? null,
            url_custom_parameters: c2Match?.UrlCustomParameters ?? null,
          },
          adgroups_after: (ag2?.AdGroups ?? []).map((a: any) => ({
            id: a.Id,
            name: a.Name,
            end_date: a.EndDate,
            multimedia_ads_bid_adjustment: a.MultimediaAdsBidAdjustment,
            audience_ads_bid_adjustment: a.AudienceAdsBidAdjustment,
          })),
        };
      } catch (err: any) {
        postAudit = { error: `re-audit failed: ${err?.message ?? String(err)}` };
      }
    }

    return json(200, {
      ok: true,
      campaign_id: campaignId,
      campaign_name: campaign?.Name,
      dry_run: dryRun,
      results,
      post_audit: postAudit,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ACTION: add-negative-keywords
  // ─────────────────────────────────────────────────────────────
  // Erwartet body.keywords als Array<{ text, matchType: 'Phrase'|'Exact' }>.
  // Idempotent: holt bestehende Negativ-Keywords, filtert Duplikate raus.
  if (action === 'add-negative-keywords') {
    const dryRun = !!body.dry_run;
    const keywordsToAdd: Array<{ text: string; matchType: 'Phrase' | 'Exact' }> =
      Array.isArray(body.keywords) ? body.keywords : [];
    if (keywordsToAdd.length === 0) {
      return json(400, { error: 'keywords_array_required_in_body' });
    }

    let campaignId: string | null = body.campaign_id ?? null;
    try {
      const campaignsResp = await getCampaigns(headers, customerAccountId);
      const campaigns = campaignsResp?.Campaigns ?? [];
      if (!campaignId) {
        if (campaigns.length === 1) {
          campaignId = String(campaigns[0].Id);
        } else if (campaigns.length > 1) {
          return json(400, {
            error: 'multiple_campaigns_pass_campaign_id',
            campaigns: campaigns.map((c: any) => ({ id: c.Id, name: c.Name })),
          });
        } else {
          return json(404, { error: 'no_campaigns_in_account' });
        }
      }
    } catch (err: any) {
      return json(500, { error: 'campaign_lookup_failed', message: err?.message ?? String(err) });
    }

    // Idempotency: hole bestehende Negativ-Keywords + filtere Duplikate raus.
    let existing: Array<{ text: string; matchType: string }> = [];
    try {
      const items = await getNegativeKeywords(headers, campaignId!);
      existing = items.map((n: any) => ({
        text: (n.Text ?? '').toLowerCase(),
        matchType: n.MatchType ?? '',
      }));
    } catch (err: any) {
      console.log(`[add-negative-keywords] could not list existing: ${err?.message ?? err}`);
    }

    const isDup = (k: { text: string; matchType: string }) =>
      existing.some(
        (e) => e.text === k.text.toLowerCase() && e.matchType === k.matchType,
      );

    const newKeywords = keywordsToAdd.filter((k) => !isDup(k));

    if (newKeywords.length === 0) {
      return json(200, {
        ok: true,
        campaign_id: campaignId,
        action: 'add-negative-keywords',
        skipped: true,
        reason: 'all_keywords_already_exist',
        existing_count: existing.length,
        proposed_count: keywordsToAdd.length,
      });
    }

    if (dryRun) {
      return json(200, {
        ok: true,
        campaign_id: campaignId,
        dry_run: true,
        action: 'add-negative-keywords',
        existing_count: existing.length,
        new_to_add: newKeywords.length,
        new_keywords: newKeywords,
      });
    }

    // Bing erlaubt 5000 Negative Keywords pro Campaign — wir senden ~80, also 1 Call.
    try {
      const resp = await addCampaignNegativeKeywords(headers, campaignId!, newKeywords);
      const partialErr = summarizePartialErrors(resp);
      // NegativeKeywordIds kommt entweder als flaches Array oder als
      // verschachteltes [[id1, id2, ...]] / [{Ids:[...]}, ...] zurück.
      const idArrays: any[] = Array.isArray(resp?.NegativeKeywordIds)
        ? resp.NegativeKeywordIds
        : [];
      const flatIds = idArrays.flatMap((arr: any) =>
        Array.isArray(arr?.Ids) ? arr.Ids : (Array.isArray(arr) ? arr : [arr]),
      );
      const successCount = flatIds.filter(
        (x: any) => x !== null && x !== undefined,
      ).length;
      return json(200, {
        ok: !partialErr,
        campaign_id: campaignId,
        action: 'add-negative-keywords',
        added: successCount,
        attempted: newKeywords.length,
        partial_errors: partialErr,
        existing_count_before: existing.length,
        raw_response_keys: resp ? Object.keys(resp) : null,
      });
    } catch (err: any) {
      return json(500, {
        error: 'add_negative_keywords_failed',
        message: err?.message ?? String(err),
      });
    }
  }

  if (action === 'deep-audit') {
    try {
      const campaignsResp = await getCampaigns(headers, customerAccountId);
      const campaigns = campaignsResp?.Campaigns ?? [];
      if (campaigns.length === 0) {
        return json(404, { error: 'no_campaigns_in_account' });
      }
      const campaign = campaigns[0];
      const campaignId = String(campaign.Id);

      const ag = await getAdGroups(headers, campaignId);
      const adGroups = ag?.AdGroups ?? [];

      const adGroupDeep = await Promise.all(
        adGroups.map(async (a: any) => {
          const adGroupId = String(a.Id);
          let kws: any[] = [];
          let ads: any[] = [];
          let kwErr: string | undefined;
          let adErr: string | undefined;
          try {
            const k = await getKeywords(headers, adGroupId);
            kws = k?.Keywords ?? [];
          } catch (e: any) { kwErr = e?.message ?? String(e); }
          try {
            const adResp = await getAds(headers, adGroupId);
            ads = adResp?.Ads ?? [];
          } catch (e: any) { adErr = e?.message ?? String(e); }

          const matchTypeBreakdown = kws.reduce((acc: Record<string, number>, k: any) => {
            const mt = k.MatchType ?? 'Unknown';
            acc[mt] = (acc[mt] ?? 0) + 1;
            return acc;
          }, {});

          const adTypeBreakdown = ads.reduce((acc: Record<string, number>, ad: any) => {
            const t = ad.Type ?? 'Unknown';
            acc[t] = (acc[t] ?? 0) + 1;
            return acc;
          }, {});

          return {
            id: a.Id,
            name: a.Name,
            status: a.Status,
            keyword_count: kws.length,
            keyword_match_types: matchTypeBreakdown,
            keywords_sample: kws.slice(0, 5).map((k: any) => ({
              text: k.Text,
              match_type: k.MatchType,
              status: k.Status,
              bid: k.Bid?.Amount,
            })),
            keyword_query_error: kwErr,
            ad_count: ads.length,
            ad_types: adTypeBreakdown,
            has_responsive_search_ad: (adTypeBreakdown['ResponsiveSearch'] ?? 0) > 0,
            ad_query_error: adErr,
          };
        }),
      );

      // Negative Keywords (Campaign-Level)
      let negKws: Array<{ Text: string; MatchType: string; Id?: string | number }> = [];
      let negErr: string | undefined;
      try {
        negKws = await getNegativeKeywords(headers, campaignId);
      } catch (e: any) { negErr = e?.message ?? String(e); }

      // Campaign Criterions (Ad Schedule, Location, Language, Device, Audience, ...)
      let criterions: any[] = [];
      let critErrorsByType: Record<string, string> = {};
      try {
        const c = await getCampaignCriterions(headers, campaignId);
        criterions = c.criterions;
        critErrorsByType = c.errorsByType;
      } catch (e: any) { critErrorsByType['_all'] = e?.message ?? String(e); }

      const critByType = criterions.reduce((acc: Record<string, number>, c: any) => {
        const t = c.Criterion?.Type ?? c.Type ?? 'Unknown';
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {});

      // Bing returnt den Type des Criterion mit Suffix, also "DayTimeCriterion".
      const adSchedules = criterions.filter(
        (c: any) => c.Criterion?.Type === 'DayTimeCriterion',
      );
      const adSchedulesDetail = adSchedules.map((c: any) => ({
        id: c.Id,
        bid_modifier: c.CriterionBid?.Multiplier,
        day: c.Criterion?.Day,
        from_hour: c.Criterion?.FromHour,
        from_minute: c.Criterion?.FromMinute,
        to_hour: c.Criterion?.ToHour,
        to_minute: c.Criterion?.ToMinute,
      }));

      // Aggregate findings
      const totalKeywords = adGroupDeep.reduce((s, ag) => s + ag.keyword_count, 0);
      const totalAds = adGroupDeep.reduce((s, ag) => s + ag.ad_count, 0);
      const adGroupsWithoutRSA = adGroupDeep.filter((ag) => !ag.has_responsive_search_ad);
      const matchTypeTotals = adGroupDeep.reduce((acc: Record<string, number>, ag) => {
        for (const [mt, n] of Object.entries(ag.keyword_match_types)) {
          acc[mt] = (acc[mt] ?? 0) + (n as number);
        }
        return acc;
      }, {});

      return json(200, {
        ok: true,
        campaign: { id: campaign.Id, name: campaign.Name, goal_ids: campaign.GoalIds ?? null },
        summary: {
          ad_group_count: adGroups.length,
          total_keywords: totalKeywords,
          total_ads: totalAds,
          match_type_breakdown: matchTypeTotals,
          ad_groups_without_responsive_search_ad: adGroupsWithoutRSA.map((ag) => ag.name),
          negative_keyword_count: negKws.length,
          criterion_count_by_type: critByType,
          ad_schedule_count: adSchedules.length,
        },
        ad_groups: adGroupDeep,
        negative_keywords_sample: negKws.slice(0, 30).map((n: any) => ({
          text: n.Text,
          match_type: n.MatchType,
        })),
        ad_schedules: adSchedulesDetail,
        criterions_count: criterions.length,
        errors: {
          negative_keywords: negErr,
          criterions: critErrorsByType,
        },
      });
    } catch (err: any) {
      return json(500, { error: 'deep_audit_failed', message: err?.message ?? String(err) });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ACTION: remove-ad-schedule
  // ─────────────────────────────────────────────────────────────
  // Löscht alle DayTime-CampaignCriterions → Anzeigen laufen 24/7.
  // Endpoint: POST /CampaignCriterions/DeleteByIds
  if (action === 'remove-ad-schedule') {
    const dryRun = !!body.dry_run;
    let campaignId: string | null = body.campaign_id ?? null;
    try {
      const campaignsResp = await getCampaigns(headers, customerAccountId);
      const campaigns = campaignsResp?.Campaigns ?? [];
      if (!campaignId) {
        if (campaigns.length === 1) campaignId = String(campaigns[0].Id);
        else if (campaigns.length > 1) return json(400, { error: 'multiple_campaigns_pass_campaign_id' });
        else return json(404, { error: 'no_campaigns_in_account' });
      }
    } catch (err: any) {
      return json(500, { error: 'campaign_lookup_failed', message: err?.message ?? String(err) });
    }

    // Alle DayTime-Kriterien holen
    let dayTimeIds: string[] = [];
    try {
      const resp = await bingFetch(
        `${BING_API_BASE}/CampaignCriterions/QueryByIds`,
        {
          method: 'POST',
          headers: buildHeaders(headers),
          body: JSON.stringify({ CampaignId: campaignId, CriterionType: 'DayTime' }),
        },
        'GetCampaignCriterionsByIds[DayTime]',
      );
      const items: any[] = Array.isArray(resp?.CampaignCriterions) ? resp.CampaignCriterions : [];
      dayTimeIds = items.map((c) => String(c.Id)).filter(Boolean);
    } catch (err: any) {
      return json(500, { error: 'criterion_lookup_failed', message: err?.message ?? String(err) });
    }

    if (dayTimeIds.length === 0) {
      return json(200, {
        ok: true,
        campaign_id: campaignId,
        action: 'remove-ad-schedule',
        skipped: true,
        reason: 'no_ad_schedule_criterions_found_already_24_7',
      });
    }

    if (dryRun) {
      return json(200, {
        ok: true,
        campaign_id: campaignId,
        dry_run: true,
        action: 'remove-ad-schedule',
        would_delete: dayTimeIds.length,
        criterion_ids: dayTimeIds,
      });
    }

    try {
      // CRITICAL Bing-Quirk: Beim DELETEN von Target-Criterions (Age, DayTime,
      // Device, Gender, Location, LocationIntent, Radius) MUSS CriterionType
      // = "Targets" gesetzt werden, NICHT der spezifische Typ.
      // Beim GET ist es genau umgekehrt — dort muss der spezifische Typ rein.
      // Quelle: learn.microsoft.com /campaign-management-service/deletecampaigncriterions
      const resp = await bingFetch(
        `${BING_API_BASE}/CampaignCriterions`,
        {
          method: 'DELETE',
          headers: buildHeaders(headers),
          body: JSON.stringify({
            CampaignId: campaignId,
            CampaignCriterionIds: dayTimeIds,
            CriterionType: 'Targets',
          }),
        },
        'DeleteCampaignCriterions',
      );
      const partialErr = summarizePartialErrors(resp);
      return json(200, {
        ok: !partialErr,
        campaign_id: campaignId,
        action: 'remove-ad-schedule',
        deleted: dayTimeIds.length,
        partial_errors: partialErr,
        raw_response: resp,
      });
    } catch (err: any) {
      return json(500, { error: 'delete_criterions_failed', message: err?.message ?? String(err) });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ACTION: super-audit
  // ─────────────────────────────────────────────────────────────
  // Komplett-Inspektion: Settings, Languages, BiddingScheme, Editorial-Status,
  // pro-Keyword Bid+URL+Status, pro-Ad EditorialStatus+FinalUrls, AccountGoals,
  // AdGroup-Default-Bids. Ein Read-Only-Mega-Snapshot fuer den 14-Tage-Review.
  if (action === 'super-audit') {
    try {
      const campaignsResp = await getCampaigns(headers, customerAccountId);
      const campaigns = campaignsResp?.Campaigns ?? [];
      if (campaigns.length === 0) return json(404, { error: 'no_campaigns' });
      const campaign = campaigns[0];
      const campaignId = String(campaign.Id);

      // AdGroupAdditionalField enum (MS Learn): AdGroupType, AdRotation,
      // AdScheduleUseSearcherTimeZone, AudienceAdsBidAdjustment,
      // BidStrategyId, FinalUrlSuffix, FrequencyCapSettings,
      // MultimediaAdsBidAdjustment, TrackingUrlTemplate, UrlCustomParameters.
      // CpcBid + Language + Status sind Default-Felder und MÜSSEN
      // weggelassen werden — sonst HTTP 400 NullRequest.
      const ag = await bingFetch(
        `${BING_API_BASE}/AdGroups/QueryByCampaignId`,
        {
          method: 'POST',
          headers: buildHeaders(headers),
          body: JSON.stringify({
            CampaignId: campaignId,
            ReturnAdditionalFields:
              'AdGroupType AdRotation MultimediaAdsBidAdjustment AudienceAdsBidAdjustment TrackingUrlTemplate FinalUrlSuffix UrlCustomParameters BidStrategyId',
          }),
        },
        'GetAdGroups[super]',
      );
      const adGroups = ag?.AdGroups ?? [];

      const adGroupDeep = await Promise.all(adGroups.map(async (a: any) => {
        const adGroupId = String(a.Id);
        let kws: any[] = [];
        let ads: any[] = [];
        try {
          const k = await bingFetch(
            `${BING_API_BASE}/Keywords/QueryByAdGroupId`,
            {
              method: 'POST',
              headers: buildHeaders(headers),
              body: JSON.stringify({ AdGroupId: adGroupId }),
            },
            'GetKeywords[super]',
          );
          kws = k?.Keywords ?? [];
        } catch {}
        try {
          // AdAdditionalField enum erlaubt nur: ImpressionTrackingUrls, Videos.
          // FinalUrls/TrackingUrlTemplate/UrlCustomParameters sind Default-Felder.
          const adResp = await bingFetch(
            `${BING_API_BASE}/Ads/QueryByAdGroupId`,
            {
              method: 'POST',
              headers: buildHeaders(headers),
              body: JSON.stringify({
                AdGroupId: adGroupId,
                AdTypes: ['ResponsiveSearch', 'ExpandedText', 'DynamicSearch'],
                ReturnAdditionalFields: 'ImpressionTrackingUrls',
              }),
            },
            'GetAds[super]',
          );
          ads = adResp?.Ads ?? [];
        } catch {}

        // Keyword stats
        const bids = kws.map((k: any) => Number(k.Bid?.Amount)).filter((n) => !isNaN(n) && n > 0);
        const editorialKw = kws.reduce((acc: any, k: any) => {
          const s = k.EditorialStatus ?? 'Unknown';
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});
        const statusKw = kws.reduce((acc: any, k: any) => {
          const s = k.Status ?? 'Unknown';
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});
        const finalUrlHostsKw = new Set<string>();
        for (const k of kws) {
          const urls: string[] = k.FinalUrls ?? [];
          for (const u of urls) {
            try { finalUrlHostsKw.add(new URL(u).host); } catch {}
          }
        }

        // Ad stats
        const editorialAd = ads.reduce((acc: any, ad: any) => {
          const s = ad.EditorialStatus ?? 'Unknown';
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});
        const statusAd = ads.reduce((acc: any, ad: any) => {
          const s = ad.Status ?? 'Unknown';
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});
        const finalUrlHostsAd = new Set<string>();
        const headlineCounts: number[] = [];
        const descriptionCounts: number[] = [];
        for (const ad of ads) {
          const urls: string[] = ad.FinalUrls ?? [];
          for (const u of urls) {
            try { finalUrlHostsAd.add(new URL(u).host); } catch {}
          }
          if (ad.Type === 'ResponsiveSearch') {
            headlineCounts.push(Array.isArray(ad.Headlines) ? ad.Headlines.length : 0);
            descriptionCounts.push(Array.isArray(ad.Descriptions) ? ad.Descriptions.length : 0);
          }
        }

        // Disapproved Items mit Reason
        const disapprovedKw = kws
          .filter((k: any) => k.EditorialStatus === 'Disapproved')
          .map((k: any) => ({ id: k.Id, text: k.Text, match_type: k.MatchType, reasons: k.EditorialAppealStatus ?? null }));
        const disapprovedAd = ads
          .filter((ad: any) => ad.EditorialStatus === 'Disapproved')
          .map((ad: any) => ({ id: ad.Id, type: ad.Type, headlines_count: ad.Headlines?.length, reasons: ad.EditorialAppealStatus ?? null }));

        return {
          id: a.Id,
          name: a.Name,
          status: a.Status,
          ad_group_type: a.AdGroupType,
          ad_rotation: a.AdRotation?.Type,
          language: a.Language,
          default_cpc_bid: a.CpcBid?.Amount,
          tracking_url_template: a.TrackingUrlTemplate ?? null,
          keyword_count: kws.length,
          keyword_editorial_status: editorialKw,
          keyword_status: statusKw,
          keyword_bid_min: bids.length ? Math.min(...bids) : null,
          keyword_bid_max: bids.length ? Math.max(...bids) : null,
          keyword_bid_avg: bids.length ? Number((bids.reduce((s, b) => s + b, 0) / bids.length).toFixed(2)) : null,
          keyword_final_url_hosts: Array.from(finalUrlHostsKw),
          ad_count: ads.length,
          ad_editorial_status: editorialAd,
          ad_status: statusAd,
          ad_final_url_hosts: Array.from(finalUrlHostsAd),
          rsa_headline_counts: headlineCounts,
          rsa_description_counts: descriptionCounts,
          disapproved_keywords: disapprovedKw,
          disapproved_ads: disapprovedAd,
        };
      }));

      // Account-level Conversion Goals (alle, die im Account existieren)
      let accountGoals: any[] = [];
      let accountGoalsErr: string | undefined;
      try {
        const goalsResp = await bingFetch(
          `${BING_API_BASE}/ConversionGoals/QueryByAccountId`,
          {
            method: 'POST',
            headers: buildHeaders(headers),
            body: JSON.stringify({
              ConversionGoalTypes: 'AppInstall Duration Event InStoreTransaction OfflineConversion PageLoad ProductPurchase Url MultiStage',
            }),
          },
          'GetConversionGoalsByAccountId',
        );
        accountGoals = goalsResp?.ConversionGoals ?? [];
      } catch (e: any) { accountGoalsErr = e?.message ?? String(e); }

      // Ad Extensions am Campaign-Level
      let extensionAssociations: any = null;
      let extErr: string | undefined;
      try {
        const extResp = await bingFetch(
          `${BING_API_BASE}/AdExtensionsAssociations/QueryByIds`,
          {
            method: 'POST',
            headers: buildHeaders(headers),
            body: JSON.stringify({
              EntityIds: [campaignId],
              AssociationType: 'Campaign',
              AdExtensionTypes: [
                'CallAdExtension',
                'CalloutAdExtension',
                'ImageAdExtension',
                'LocationAdExtension',
                'PriceAdExtension',
                'PromotionAdExtension',
                'ReviewAdExtension',
                'SitelinkAdExtension',
                'StructuredSnippetAdExtension',
                'AppAdExtension',
                'ActionAdExtension',
                'FilterLinkAdExtension',
                'FlyerAdExtension',
                'VideoAdExtension',
              ],
            }),
          },
          'GetAdExtensionsAssociationsByIds',
        );
        const all = extResp?.AdExtensionAssociationCollection ?? [];
        const flat: any[] = [];
        for (const bucket of all) {
          if (Array.isArray(bucket?.AdExtensionAssociations)) {
            flat.push(...bucket.AdExtensionAssociations);
          }
        }
        const byType: Record<string, number> = {};
        for (const f of flat) {
          const t = f?.AdExtension?.Type ?? 'Unknown';
          byType[t] = (byType[t] ?? 0) + 1;
        }
        extensionAssociations = { count: flat.length, by_type: byType };
      } catch (e: any) { extErr = e?.message ?? String(e); }

      // Aggregat
      const totalKeywords = adGroupDeep.reduce((s, ag) => s + ag.keyword_count, 0);
      const totalAds = adGroupDeep.reduce((s, ag) => s + ag.ad_count, 0);
      const allDisapprovedAds = adGroupDeep.reduce((s, ag) => s + ag.disapproved_ads.length, 0);
      const allDisapprovedKws = adGroupDeep.reduce((s, ag) => s + ag.disapproved_keywords.length, 0);
      const allKwHosts = new Set<string>();
      const allAdHosts = new Set<string>();
      adGroupDeep.forEach((ag) => {
        ag.keyword_final_url_hosts.forEach((h: string) => allKwHosts.add(h));
        ag.ad_final_url_hosts.forEach((h: string) => allAdHosts.add(h));
      });
      const allBids = adGroupDeep
        .filter((ag) => ag.default_cpc_bid != null)
        .map((ag) => Number(ag.default_cpc_bid));

      return json(200, {
        ok: true,
        campaign: {
          id: campaign.Id,
          name: campaign.Name,
          status: campaign.Status,
          daily_budget: campaign.DailyBudget,
          budget_type: campaign.BudgetType,
          time_zone: campaign.TimeZone,
          languages: campaign.Languages,
          campaign_type: campaign.CampaignType,
          sub_type: campaign.SubType,
          tracking_url_template: campaign.TrackingUrlTemplate ?? null,
          final_url_suffix: campaign.FinalUrlSuffix ?? null,
          url_custom_parameters: campaign.UrlCustomParameters ?? null,
          bidding_scheme: campaign.BiddingScheme ?? null,
          settings: campaign.Settings ?? null,
          goal_ids: campaign.GoalIds ?? null,
        },
        critical_findings: {
          campaign_status_not_active: campaign.Status !== 'Active',
          languages_missing_or_all: !campaign.Languages || (Array.isArray(campaign.Languages) && (campaign.Languages.length === 0 || campaign.Languages.includes('All'))),
          no_conversion_goals_linked: !campaign.GoalIds || (Array.isArray(campaign.GoalIds) && campaign.GoalIds.length === 0),
          tracking_template_missing: !campaign.TrackingUrlTemplate,
          disapproved_ads_total: allDisapprovedAds,
          disapproved_keywords_total: allDisapprovedKws,
          unexpected_keyword_url_hosts: Array.from(allKwHosts).filter((h) => !h.includes('kuechenwert24.de')),
          unexpected_ad_url_hosts: Array.from(allAdHosts).filter((h) => !h.includes('kuechenwert24.de')),
          adgroup_default_bid_min: allBids.length ? Math.min(...allBids) : null,
          adgroup_default_bid_max: allBids.length ? Math.max(...allBids) : null,
        },
        ad_groups_summary: adGroupDeep,
        account_conversion_goals: {
          count: accountGoals.length,
          goals: accountGoals.map((g: any) => ({
            id: g.Id,
            name: g.Name,
            type: g.Type,
            status: g.Status,
            revenue_type: g.Revenue?.Type,
            revenue_value: g.Revenue?.Value,
            count_type: g.Scope ?? null,
          })),
          error: accountGoalsErr,
        },
        ad_extensions_summary: extensionAssociations,
        ad_extensions_error: extErr,
        totals: { ad_groups: adGroups.length, keywords: totalKeywords, ads: totalAds },
      });
    } catch (err: any) {
      return json(500, { error: 'super_audit_failed', message: err?.message ?? String(err) });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ACTION: attach-conversion-goals
  // ─────────────────────────────────────────────────────────────
  // Setzt die GoalIds auf der Kampagne. Wenn keine angegeben werden, werden
  // alle aktiven Account-Conversion-Goals automatisch verlinkt.
  if (action === 'attach-conversion-goals') {
    const dryRun = !!body.dry_run;
    let campaignId: string | null = body.campaign_id ?? null;
    let campaign: any = null;
    try {
      const campaignsResp = await getCampaigns(headers, customerAccountId);
      const campaigns = campaignsResp?.Campaigns ?? [];
      if (!campaignId) {
        if (campaigns.length === 1) campaignId = String(campaigns[0].Id);
        else return json(400, { error: 'campaign_id_required' });
      }
      campaign = campaigns.find((c: any) => String(c.Id) === String(campaignId));
    } catch (err: any) {
      return json(500, { error: 'campaign_lookup_failed', message: err?.message ?? String(err) });
    }

    let goalIds: number[] = Array.isArray(body.goal_ids)
      ? body.goal_ids.map((g: any) => Number(g)).filter((n: number) => !isNaN(n))
      : [];

    if (goalIds.length === 0) {
      // Auto: alle aktiven Goals aus Account holen
      try {
        const goalsResp = await bingFetch(
          `${BING_API_BASE}/ConversionGoals/QueryByAccountId`,
          {
            method: 'POST',
            headers: buildHeaders(headers),
            body: JSON.stringify({
              ConversionGoalTypes: 'AppInstall Duration Event InStoreTransaction OfflineConversion PageLoad ProductPurchase Url MultiStage',
            }),
          },
          'GetConversionGoalsByAccountId',
        );
        const goals = goalsResp?.ConversionGoals ?? [];
        goalIds = goals
          .filter((g: any) => g.Status === 'Active')
          .map((g: any) => Number(g.Id))
          .filter((n: number) => !isNaN(n));
      } catch (err: any) {
        return json(500, { error: 'goals_lookup_failed', message: err?.message ?? String(err) });
      }
    }

    if (goalIds.length === 0) {
      return json(400, {
        error: 'no_active_goals_found',
        hint: 'Pass body.goal_ids = [123,456] explicitly, or check that account-level conversion goals exist and are Active.',
      });
    }

    if (dryRun) {
      return json(200, {
        ok: true,
        dry_run: true,
        campaign_id: campaignId,
        previous_goal_ids: campaign?.GoalIds ?? null,
        new_goal_ids: goalIds,
      });
    }

    try {
      const resp = await bingFetch(
        `${BING_API_BASE}/Campaigns`,
        {
          method: 'PUT',
          headers: buildHeaders(headers),
          body: JSON.stringify({
            AccountId: customerAccountId,
            Campaigns: [{ Id: campaign.Id, GoalIds: goalIds }],
          }),
        },
        'UpdateCampaigns[GoalIds]',
      );
      const partialErr = summarizePartialErrors(resp);
      return json(200, {
        ok: !partialErr,
        campaign_id: campaignId,
        previous_goal_ids: campaign?.GoalIds ?? null,
        new_goal_ids: goalIds,
        partial_errors: partialErr,
      });
    } catch (err: any) {
      return json(500, { error: 'attach_goals_failed', message: err?.message ?? String(err) });
    }
  }

  return json(400, {
    error: 'unknown_action',
    valid_actions: [
      'audit',
      'apply-fixes',
      'deep-audit',
      'super-audit',
      'add-negative-keywords',
      'remove-ad-schedule',
      'attach-conversion-goals',
    ],
    received: action,
  });
});
