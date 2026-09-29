/**
 * Setzt KW_ADS_PLAN (_shared/google-ads-plan.ts) im Konto um.
 *
 *   { action: "campaigns", mode: "plan" }      Abgleich Plan ↔ Konto, nur lesend
 *   { action: "campaigns", mode: "validate" }  zusätzlich Prüfung durch Google (validateOnly)
 *   { action: "campaigns", mode: "apply" }     Fehlendes anlegen, ein atomarer Mutate
 *
 * Neue Kampagnen entstehen pausiert; nichts wird gelöscht oder überschrieben.
 *
 *   { action: "campaign-settings", key, status?, dailyBudgetEur?, bidding?, cpcCeilingEur?, targetCpaEur?, dryRun? }
 *     Start/Pause, Tagesbudget und Gebotsleiter (MAXIMIZE_CLICKS mit CPC-Deckel →
 *     MAXIMIZE_CONVERSIONS, optional mit Ziel-CPA) einer Plan-Kampagne.
 */

import {
  GoogleAdsApiError,
  describeGoogleAdsError,
  type GadsRow,
  type GoogleAdsClient,
} from "../_shared/google-ads.ts";
import {
  KW_ADS_PLAN,
  validatePlan,
  type AccountPlan,
  type CampaignPlan,
  type Keyword,
} from "../_shared/google-ads-plan.ts";
import { HttpError } from "../_shared/kw-http.ts";

const micros = (eur: number) => String(Math.round(eur * 1_000_000));
const kwKey = (k: { text?: string; match?: string; matchType?: string }) =>
  `${String(k.text ?? "").toLowerCase()}|${k.match ?? k.matchType ?? ""}`;
const gaqlString = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

interface LiveState {
  campaigns: Map<string, string>;
  adGroups: Map<string, string>;
  keywords: Set<string>;
  adGroupsWithAds: Set<string>;
  ads: Array<{ campaign: string; adGroup: string; status: string; approval: string; strength: string }>;
  campaignCriteria: Set<string>;
  sharedSets: Map<string, string>;
  sharedCriteria: Set<string>;
  campaignSharedSets: Set<string>;
  sitelinkAssets: Map<string, string>;
  calloutAssets: Map<string, string>;
  snippetAssets: Map<string, string>;
  campaignAssets: Set<string>;
  customerAssets: Set<string>;
}

const LIVE_QUERIES = {
  adGroups: `SELECT campaign.resource_name, ad_group.resource_name, ad_group.name FROM ad_group
    WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`,
  keywords: `SELECT ad_group.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
    FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
    AND ad_group_criterion.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`,
  ads: `SELECT campaign.name, ad_group.resource_name, ad_group.name, ad_group_ad.status,
    ad_group_ad.policy_summary.approval_status, ad_group_ad.ad_strength FROM ad_group_ad
    WHERE ad_group_ad.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`,
  criteria: `SELECT campaign.resource_name, campaign_criterion.type, campaign_criterion.negative,
    campaign_criterion.keyword.text, campaign_criterion.keyword.match_type,
    campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant,
    campaign_criterion.user_interest.user_interest_category FROM campaign_criterion WHERE campaign.status != 'REMOVED'`,
  sharedSets: `SELECT shared_set.resource_name, shared_set.name FROM shared_set
    WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_set.status = 'ENABLED'`,
  sharedCriteria: `SELECT shared_set.resource_name, shared_criterion.keyword.text, shared_criterion.keyword.match_type
    FROM shared_criterion WHERE shared_set.status = 'ENABLED' AND shared_criterion.type = 'KEYWORD'`,
  campaignSharedSets: `SELECT campaign.resource_name, campaign_shared_set.shared_set FROM campaign_shared_set
    WHERE campaign_shared_set.status = 'ENABLED'`,
  assets: `SELECT asset.resource_name, asset.type, asset.final_urls, asset.sitelink_asset.link_text,
    asset.sitelink_asset.description1, asset.sitelink_asset.description2, asset.callout_asset.callout_text,
    asset.structured_snippet_asset.header, asset.structured_snippet_asset.values FROM asset
    WHERE asset.type IN ('SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET')`,
  campaignAssets: `SELECT campaign.resource_name, campaign_asset.asset, campaign_asset.field_type FROM campaign_asset
    WHERE campaign_asset.status != 'REMOVED'`,
  customerAssets: `SELECT customer_asset.asset, customer_asset.field_type FROM customer_asset
    WHERE customer_asset.status != 'REMOVED'`,
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function loadLive(client: GoogleAdsClient): Promise<LiveState> {
  const campaignRows = await client.search(
    "SELECT campaign.resource_name, campaign.name FROM campaign WHERE campaign.status != 'REMOVED'",
  );
  const keys = Object.keys(LIVE_QUERIES) as Array<keyof typeof LIVE_QUERIES>;
  const results = await Promise.all(keys.map((k) => client.search(LIVE_QUERIES[k])));
  const rows = Object.fromEntries(keys.map((k, i) => [k, results[i]])) as Record<keyof typeof LIVE_QUERIES, GadsRow[]>;

  const live: LiveState = {
    campaigns: new Map(campaignRows.map((r) => [str(obj(r.campaign).name), str(obj(r.campaign).resourceName)])),
    adGroups: new Map(),
    keywords: new Set(),
    adGroupsWithAds: new Set(),
    ads: [],
    campaignCriteria: new Set(),
    sharedSets: new Map(),
    sharedCriteria: new Set(),
    campaignSharedSets: new Set(),
    sitelinkAssets: new Map(),
    calloutAssets: new Map(),
    snippetAssets: new Map(),
    campaignAssets: new Set(),
    customerAssets: new Set(),
  };
  for (const r of rows.adGroups) {
    live.adGroups.set(`${str(obj(r.campaign).resourceName)}|${str(obj(r.adGroup).name)}`, str(obj(r.adGroup).resourceName));
  }
  for (const r of rows.keywords) {
    live.keywords.add(`${str(obj(r.adGroup).resourceName)}|${kwKey(obj(obj(r.adGroupCriterion).keyword))}`);
  }
  for (const r of rows.ads) {
    const ad = obj(r.adGroupAd);
    live.adGroupsWithAds.add(str(obj(r.adGroup).resourceName));
    live.ads.push({
      campaign: str(obj(r.campaign).name),
      adGroup: str(obj(r.adGroup).name),
      status: str(ad.status),
      approval: str(obj(ad.policySummary).approvalStatus),
      strength: str(ad.adStrength),
    });
  }
  for (const r of rows.criteria) {
    const c = obj(r.campaignCriterion);
    const camp = str(obj(r.campaign).resourceName);
    if (c.type === "KEYWORD" && c.negative === true) live.campaignCriteria.add(`${camp}|neg|${kwKey(obj(c.keyword))}`);
    if (c.type === "LOCATION") live.campaignCriteria.add(`${camp}|geo|${str(obj(c.location).geoTargetConstant)}`);
    if (c.type === "LANGUAGE") live.campaignCriteria.add(`${camp}|lang|${str(obj(c.language).languageConstant)}`);
    if (c.type === "USER_INTEREST") {
      live.campaignCriteria.add(`${camp}|ui|${str(obj(c.userInterest).userInterestCategory)}`);
    }
  }
  for (const r of rows.sharedSets) live.sharedSets.set(str(obj(r.sharedSet).name), str(obj(r.sharedSet).resourceName));
  for (const r of rows.sharedCriteria) {
    live.sharedCriteria.add(`${str(obj(r.sharedSet).resourceName)}|${kwKey(obj(obj(r.sharedCriterion).keyword))}`);
  }
  for (const r of rows.campaignSharedSets) {
    live.campaignSharedSets.add(`${str(obj(r.campaign).resourceName)}|${str(obj(r.campaignSharedSet).sharedSet)}`);
  }
  for (const r of rows.assets) {
    const a = obj(r.asset);
    const rn = str(a.resourceName);
    if (a.type === "SITELINK") {
      const s = obj(a.sitelinkAsset);
      const url = (Array.isArray(a.finalUrls) ? a.finalUrls : [])[0] ?? "";
      live.sitelinkAssets.set(`${str(s.linkText)}|${str(s.description1)}|${str(s.description2)}|${url}`, rn);
    }
    if (a.type === "CALLOUT") live.calloutAssets.set(str(obj(a.calloutAsset).calloutText), rn);
    if (a.type === "STRUCTURED_SNIPPET") {
      const s = obj(a.structuredSnippetAsset);
      live.snippetAssets.set(`${str(s.header)}|${(Array.isArray(s.values) ? s.values : []).join("|")}`, rn);
    }
  }
  for (const r of rows.campaignAssets) {
    const ca = obj(r.campaignAsset);
    live.campaignAssets.add(`${str(obj(r.campaign).resourceName)}|${str(ca.asset)}|${str(ca.fieldType)}`);
  }
  for (const r of rows.customerAssets) {
    const ca = obj(r.customerAsset);
    live.customerAssets.add(`${str(ca.asset)}|${str(ca.fieldType)}`);
  }
  return live;
}

function campaignResource(c: CampaignPlan, resourceName: string, budget: string): Obj {
  const bidding =
    c.bidding.type === "MAXIMIZE_CLICKS"
      ? { targetSpend: { cpcBidCeilingMicros: micros(c.bidding.cpcCeilingEur) } }
      : {
          targetImpressionShare: {
            location: "ABSOLUTE_TOP_OF_PAGE",
            locationFractionMicros: String(Math.round(c.bidding.absoluteTopShare * 1_000_000)),
            cpcBidCeilingMicros: micros(c.bidding.cpcCeilingEur),
          },
        };
  return {
    resourceName,
    name: c.name,
    status: "PAUSED",
    advertisingChannelType: "SEARCH",
    campaignBudget: budget,
    networkSettings: {
      targetGoogleSearch: true,
      targetSearchNetwork: false,
      targetContentNetwork: false,
      targetPartnerSearchNetwork: false,
    },
    geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE", negativeGeoTargetType: "PRESENCE" },
    ...(c.observeAudiences
      ? { targetingSetting: { targetRestrictions: [{ targetingDimension: "AUDIENCE", bidOnly: true }] } }
      : {}),
    containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    ...bidding,
  };
}

interface Planned {
  operations: Obj[];
  /** Beschriftung je Operation, damit Google-Fehler (mutate_operations[i]) lesbar werden. */
  labels: string[];
  counts: Record<string, number>;
  created: string[];
}

function planOperations(plan: AccountPlan, live: LiveState, customerId: string): Planned {
  let nextId = -1;
  const temp = (collection: string) => `customers/${customerId}/${collection}/${nextId--}`;
  const out: Planned = { operations: [], labels: [], counts: {}, created: [] };
  const add = (kind: string, label: string, operation: Obj) => {
    out.operations.push(operation);
    out.labels.push(label);
    out.counts[kind] = (out.counts[kind] ?? 0) + 1;
  };
  const url = (path: string) => `${plan.site}${path}`;
  const keyword = (k: Keyword) => ({ text: k.text, matchType: k.match });

  for (const text of plan.callouts) {
    let rn = live.calloutAssets.get(text);
    if (!rn) {
      rn = temp("assets");
      add("assets", `Callout „${text}“`, { assetOperation: { create: { resourceName: rn, calloutAsset: { calloutText: text } } } });
    }
    if (!live.customerAssets.has(`${rn}|CALLOUT`)) {
      add("accountAssetLinks", `Callout „${text}“ verknüpfen`, {
        customerAssetOperation: { create: { asset: rn, fieldType: "CALLOUT" } },
      });
    }
  }
  for (const s of plan.snippets) {
    let rn = live.snippetAssets.get(`${s.header}|${s.values.join("|")}`);
    if (!rn) {
      rn = temp("assets");
      add("assets", `Snippet „${s.header}“`, {
        assetOperation: { create: { resourceName: rn, structuredSnippetAsset: { header: s.header, values: s.values } } },
      });
    }
    if (!live.customerAssets.has(`${rn}|STRUCTURED_SNIPPET`)) {
      add("accountAssetLinks", `Snippet „${s.header}“ verknüpfen`, {
        customerAssetOperation: { create: { asset: rn, fieldType: "STRUCTURED_SNIPPET" } },
      });
    }
  }

  const sitelinkRns = new Map<string, string>();
  const sitelink = (key: string) => {
    const known = sitelinkRns.get(key);
    if (known) return known;
    const s = plan.sitelinks.find((x) => x.key === key)!;
    let rn = live.sitelinkAssets.get(`${s.text}|${s.description1}|${s.description2}|${url(s.path)}`);
    if (!rn) {
      rn = temp("assets");
      add("assets", `Sitelink „${s.text}“`, {
        assetOperation: {
          create: {
            resourceName: rn,
            finalUrls: [url(s.path)],
            sitelinkAsset: { linkText: s.text, description1: s.description1, description2: s.description2 },
          },
        },
      });
    }
    sitelinkRns.set(key, rn);
    return rn;
  };

  const list = plan.sharedNegativeList;
  let sharedRn = live.sharedSets.get(list.name);
  if (!sharedRn) {
    sharedRn = temp("sharedSets");
    add("sharedNegativeLists", `Liste „${list.name}“`, {
      sharedSetOperation: { create: { resourceName: sharedRn, name: list.name, type: "NEGATIVE_KEYWORDS" } },
    });
    out.created.push(`Ausschlussliste „${list.name}“`);
  }
  for (const k of list.keywords) {
    if (!live.sharedCriteria.has(`${sharedRn}|${kwKey(k)}`)) {
      add("sharedNegatives", `Listen-Ausschluss „${k.text}“`, {
        sharedCriterionOperation: { create: { sharedSet: sharedRn, keyword: keyword(k) } },
      });
    }
  }

  for (const c of plan.campaigns) {
    let campRn = live.campaigns.get(c.name);
    if (!campRn) {
      const budgetRn = temp("campaignBudgets");
      campRn = temp("campaigns");
      add("budgets", `Budget ${c.name}`, {
        campaignBudgetOperation: {
          create: {
            resourceName: budgetRn,
            name: `Budget | ${c.name}`,
            amountMicros: micros(c.dailyBudgetEur),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      });
      add("campaigns", `Kampagne ${c.name}`, { campaignOperation: { create: campaignResource(c, campRn, budgetRn) } });
      out.created.push(`Kampagne „${c.name}“ (pausiert, ${c.dailyBudgetEur} €/Tag)`);
    }
    for (const geo of plan.geoTargetConstants) {
      if (!live.campaignCriteria.has(`${campRn}|geo|${geo}`)) {
        add("locations", `${c.name}: Ort ${geo}`, {
          campaignCriterionOperation: { create: { campaign: campRn, location: { geoTargetConstant: geo } } },
        });
      }
    }
    for (const lang of plan.languageConstants) {
      if (!live.campaignCriteria.has(`${campRn}|lang|${lang}`)) {
        add("languages", `${c.name}: Sprache ${lang}`, {
          campaignCriterionOperation: { create: { campaign: campRn, language: { languageConstant: lang } } },
        });
      }
    }
    if (c.observeAudiences) {
      for (const id of plan.audienceUserInterestIds) {
        const category = `customers/${customerId}/userInterests/${id}`;
        if (!live.campaignCriteria.has(`${campRn}|ui|${category}`)) {
          add("audiences", `${c.name}: Zielgruppe ${id}`, {
            campaignCriterionOperation: { create: { campaign: campRn, userInterest: { userInterestCategory: category } } },
          });
        }
      }
    }
    for (const n of c.negatives) {
      if (!live.campaignCriteria.has(`${campRn}|neg|${kwKey(n)}`)) {
        add("campaignNegatives", `${c.name}: Ausschluss „${n.text}“`, {
          campaignCriterionOperation: { create: { campaign: campRn, negative: true, keyword: keyword(n) } },
        });
      }
    }
    if (c.useSharedNegatives && !live.campaignSharedSets.has(`${campRn}|${sharedRn}`)) {
      add("sharedListLinks", `${c.name}: Ausschlussliste`, {
        campaignSharedSetOperation: { create: { campaign: campRn, sharedSet: sharedRn } },
      });
    }
    for (const key of c.sitelinks) {
      const rn = sitelink(key);
      if (!live.campaignAssets.has(`${campRn}|${rn}|SITELINK`)) {
        add("sitelinkLinks", `${c.name}: Sitelink ${key}`, {
          campaignAssetOperation: { create: { campaign: campRn, asset: rn, fieldType: "SITELINK" } },
        });
      }
    }

    for (const ag of c.adGroups) {
      const where = `${c.name} › ${ag.name}`;
      let agRn = live.adGroups.get(`${campRn}|${ag.name}`);
      if (!agRn) {
        agRn = temp("adGroups");
        add("adGroups", where, {
          adGroupOperation: {
            create: { resourceName: agRn, campaign: campRn, name: ag.name, status: "ENABLED", type: "SEARCH_STANDARD" },
          },
        });
      }
      for (const k of ag.keywords) {
        if (!live.keywords.has(`${agRn}|${kwKey(k)}`)) {
          add("keywords", `${where}: Keyword „${k.text}“ (${k.match})`, {
            adGroupCriterionOperation: { create: { adGroup: agRn, status: "ENABLED", keyword: keyword(k) } },
          });
        }
      }
      if (!live.adGroupsWithAds.has(agRn)) {
        add("ads", `${where}: Anzeige`, {
          adGroupAdOperation: {
            create: {
              adGroup: agRn,
              status: "ENABLED",
              ad: {
                finalUrls: [url(ag.finalPath)],
                responsiveSearchAd: {
                  headlines: ag.ad.headlines.map((text) => ({ text })),
                  descriptions: ag.ad.descriptions.map((text) => ({ text })),
                  ...(ag.ad.path1 ? { path1: ag.ad.path1 } : {}),
                  ...(ag.ad.path2 ? { path2: ag.ad.path2 } : {}),
                },
              },
            },
          },
        });
      }
    }
  }
  return out;
}

function describeFailure(err: unknown, labels: string[]) {
  if (!(err instanceof GoogleAdsApiError)) return { error: describeGoogleAdsError(err), problems: [] };
  const problems = err.details.slice(0, 60).map((d) => ({
    operation: d.operationIndex === undefined ? undefined : labels[d.operationIndex],
    code: d.code,
    message: d.message,
    trigger: d.trigger,
    policyTopics: d.policyTopics,
    field: d.field,
  }));
  return { error: err.message, problems };
}

export async function runCampaigns(client: GoogleAdsClient, body: Obj) {
  const mode = body.mode === "apply" || body.mode === "validate" ? body.mode : "plan";
  const planErrors = validatePlan(KW_ADS_PLAN);
  if (planErrors.length) return { ok: false, mode, planErrors };

  const live = await loadLive(client);
  const planned = planOperations(KW_ADS_PLAN, live, client.customerId);
  const summary = { mode, operations: planned.operations.length, counts: planned.counts, created: planned.created };
  if (mode === "plan" || planned.operations.length === 0) {
    return { ok: true, ...summary, upToDate: planned.operations.length === 0, ads: live.ads };
  }
  try {
    const result = await client.mutate("googleAds", {
      mutateOperations: planned.operations,
      partialFailure: false,
      validateOnly: mode === "validate",
    });
    const responses = Array.isArray(result.mutateOperationResponses) ? result.mutateOperationResponses.length : 0;
    return { ok: true, ...summary, applied: mode === "apply", responses };
  } catch (err) {
    return { ok: false, ...summary, ...describeFailure(err, planned.labels) };
  }
}

const BIDDING_TYPES = new Set(["MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS"]);

function eurInRange(value: unknown, min: number, max: number, field: string): number {
  const eur = Number(value);
  if (!Number.isFinite(eur) || eur < min || eur > max) {
    throw new HttpError(400, `${field} muss zwischen ${min} und ${max} € liegen.`, "invalid_input");
  }
  return eur;
}

export async function runCampaignSettings(client: GoogleAdsClient, body: Obj) {
  const plan = KW_ADS_PLAN.campaigns.find((c) => c.key === body.key);
  if (!plan) {
    throw new HttpError(400, `key: ${KW_ADS_PLAN.campaigns.map((c) => c.key).join(", ")}`, "invalid_input");
  }
  const query = `SELECT campaign.resource_name, campaign.status, campaign.bidding_strategy_type,
    campaign.target_spend.cpc_bid_ceiling_micros, campaign.maximize_conversions.target_cpa_micros,
    campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign
    WHERE campaign.name = ${gaqlString(plan.name)} AND campaign.status != 'REMOVED'`;
  const [row] = await client.search(query);
  if (!row) throw new HttpError(404, `Kampagne „${plan.name}“ gibt es noch nicht (erst action "campaigns").`, "not_found");
  const campaign = obj(row.campaign);
  const campaignRn = str(campaign.resourceName);
  const operations: Obj[] = [];

  if (body.status !== undefined) {
    if (body.status !== "ENABLED" && body.status !== "PAUSED") {
      throw new HttpError(400, "status: ENABLED oder PAUSED.", "invalid_input");
    }
    operations.push({ campaignOperation: { update: { resourceName: campaignRn, status: body.status }, updateMask: "status" } });
  }
  if (body.dailyBudgetEur !== undefined) {
    const eur = eurInRange(body.dailyBudgetEur, 1, 1000, "dailyBudgetEur");
    operations.push({
      campaignBudgetOperation: {
        update: { resourceName: str(obj(row.campaignBudget).resourceName), amountMicros: micros(eur) },
        updateMask: "amount_micros",
      },
    });
  }
  const bidding = body.bidding ?? (body.cpcCeilingEur !== undefined ? "MAXIMIZE_CLICKS" : undefined);
  if (bidding !== undefined) {
    if (!BIDDING_TYPES.has(String(bidding))) throw new HttpError(400, "bidding: MAXIMIZE_CLICKS oder MAXIMIZE_CONVERSIONS.", "invalid_input");
    if (bidding === "MAXIMIZE_CLICKS") {
      const eur = eurInRange(body.cpcCeilingEur ?? plan.bidding.cpcCeilingEur, 0.1, 50, "cpcCeilingEur");
      operations.push({
        campaignOperation: {
          update: { resourceName: campaignRn, targetSpend: { cpcBidCeilingMicros: micros(eur) } },
          updateMask: "target_spend.cpc_bid_ceiling_micros",
        },
      });
    } else {
      const cpa = body.targetCpaEur === undefined || Number(body.targetCpaEur) === 0
        ? undefined
        : eurInRange(body.targetCpaEur, 1, 500, "targetCpaEur");
      operations.push({
        campaignOperation: {
          update: { resourceName: campaignRn, maximizeConversions: cpa ? { targetCpaMicros: micros(cpa) } : {} },
          updateMask: "maximize_conversions.target_cpa_micros",
        },
      });
    }
  }
  if (operations.length === 0) throw new HttpError(400, "Nichts zu ändern.", "invalid_input");

  try {
    await client.mutate("googleAds", { mutateOperations: operations, partialFailure: false, validateOnly: body.dryRun === true });
  } catch (err) {
    return { ok: false, key: plan.key, ...describeFailure(err, operations.map((_, i) => `Änderung ${i + 1}`)) };
  }
  const [after] = await client.search(query);
  const c = obj(after?.campaign);
  return {
    ok: true,
    key: plan.key,
    dryRun: body.dryRun === true,
    campaign: {
      name: plan.name,
      status: str(c.status),
      bidding: str(c.biddingStrategyType),
      cpcCeilingEur: Number(obj(c.targetSpend).cpcBidCeilingMicros ?? 0) / 1e6 || null,
      targetCpaEur: Number(obj(c.maximizeConversions).targetCpaMicros ?? 0) / 1e6 || null,
      dailyBudgetEur: Number(obj(after?.campaignBudget).amountMicros ?? 0) / 1e6,
    },
  };
}
