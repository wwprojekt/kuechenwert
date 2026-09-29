/**
 * Gleicht das Konto mit KW_ADS_PLAN (_shared/google-ads-plan.ts) ab.
 *
 *   { action: "campaigns", mode: "plan" }      Abgleich Plan ↔ Konto, nur lesend
 *   { action: "campaigns", mode: "validate" }  zusätzlich Prüfung durch Google (validateOnly)
 *   { action: "campaigns", mode: "apply" }     Änderungen ausführen
 *
 * Fehlendes wird angelegt (neue Kampagnen pausiert). Anzeigen sind bei Google
 * unveränderlich: weicht der Text ab, entsteht eine neue und die alte wird
 * entfernt. Keywords, Ausschlüsse und Asset-Verknüpfungen (Sitelinks,
 * Callouts, Snippets, Anruf, Firmenname, Logo, Bilder), die nicht im Plan
 * stehen, werden entfernt; automatisch erstellte Verknüpfungen bleiben.
 * Remarketing-Listen (Präfix „KüchenWert | “) hängen zur Beobachtung an den
 * Kampagnen mit observeAudiences; abweichende Regeln werden angeglichen,
 * fremde Listen bleiben unberührt.
 * Kampagnen, Anzeigengruppen und Listen werden nie gelöscht.
 *
 * Drei Pakete, jedes ein atomarer Mutate: „main“ (alles außer den beiden
 * folgenden; neue Remarketing-Listen legt ein eigener Mutate davor an, weil
 * Google für Nutzerlisten keine temporären IDs kennt), „brand“ (Firmenname und Logo, brauchen die Überprüfung des
 * Werbetreibenden) und „images“ (Bild-Assets, erst ab 60 Tagen Kontoalter
 * mit Search-Ausgaben). Lehnt Google ein Paket ab, laufen die anderen
 * trotzdem. "batches": ["brand", "images"] beschränkt validate/apply auf
 * diese Pakete; so holt der Cron kw-gads-assets-catchup sie täglich nach,
 * sobald Google sie zulässt, ohne Änderungen am Hauptpaket.
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
  IMAGE_MAX_BYTES,
  REMARKETING_PREFIX,
  imageFits,
  validatePlan,
  type AccountPlan,
  type CampaignPlan,
  type Keyword,
  type RemarketingListPlan,
} from "../_shared/google-ads-plan.ts";
import { imageInfo } from "../_shared/image-size.ts";
import { HttpError } from "../_shared/kw-http.ts";

const micros = (eur: number) => String(Math.round(eur * 1_000_000));
const kwKey = (k: { text?: string; match?: string; matchType?: string }) =>
  `${String(k.text ?? "").toLowerCase()}|${k.match ?? k.matchType ?? ""}`;
const gaqlString = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
export const imageAssetName = (file: string) => `KüchenWert | ${file}`;

/** Verknüpfungstypen, die der Plan je Ebene vollständig beschreibt. */
const MANAGED_CUSTOMER_FIELDS = new Set(["CALLOUT", "STRUCTURED_SNIPPET", "CALL", "BUSINESS_NAME", "BUSINESS_LOGO"]);
const MANAGED_CAMPAIGN_FIELDS = new Set(["SITELINK", "CALLOUT", "AD_IMAGE"]);
const BRAND_FIELDS = new Set(["BUSINESS_NAME", "BUSINESS_LOGO"]);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

interface AssetLink {
  resourceName: string;
  asset: string;
  fieldType: string;
}

interface LiveAd {
  resourceName: string;
  signature: string;
}

interface LiveState {
  campaigns: Map<string, string>;
  adGroups: Map<string, string>;
  keywords: Map<string, string>;
  ads: Array<{ campaign: string; adGroup: string; status: string; approval: string; strength: string }>;
  adsByGroup: Map<string, LiveAd[]>;
  campaignCriteria: Set<string>;
  campaignNegatives: Map<string, string>;
  sharedSets: Map<string, string>;
  sharedCriteria: Map<string, string>;
  campaignSharedSets: Set<string>;
  sitelinkAssets: Map<string, string>;
  calloutAssets: Map<string, string>;
  snippetAssets: Map<string, string>;
  imageAssets: Map<string, string>;
  callAssets: Map<string, string>;
  businessNameAsset?: string;
  campaignLinks: Map<string, AssetLink[]>;
  customerLinks: AssetLink[];
  /** Eigene Remarketing-Listen (REMARKETING_PREFIX) nach Name. */
  userLists: Map<string, { resourceName: string; rules: string }>;
  /** `${campaign}|${userList}` → Kriterium. */
  campaignUserLists: Map<string, string>;
}

function liveQueries(plan: AccountPlan) {
  return {
    adGroups: `SELECT campaign.resource_name, ad_group.resource_name, ad_group.name FROM ad_group
      WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`,
    keywords: `SELECT ad_group.resource_name, ad_group_criterion.resource_name, ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'
      AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`,
    ads: `SELECT campaign.name, ad_group.resource_name, ad_group.name, ad_group_ad.resource_name, ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status, ad_group_ad.ad_strength, ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2 FROM ad_group_ad
      WHERE ad_group_ad.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`,
    criteria: `SELECT campaign.resource_name, campaign_criterion.resource_name, campaign_criterion.type,
      campaign_criterion.negative, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type,
      campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant,
      campaign_criterion.user_interest.user_interest_category, campaign_criterion.user_list.user_list
      FROM campaign_criterion WHERE campaign.status != 'REMOVED'`,
    userLists: `SELECT user_list.resource_name, user_list.name,
      user_list.rule_based_user_list.flexible_rule_user_list.inclusive_operands,
      user_list.rule_based_user_list.flexible_rule_user_list.exclusive_operands FROM user_list
      WHERE user_list.type = 'RULE_BASED'`,
    sharedSets: `SELECT shared_set.resource_name, shared_set.name FROM shared_set
      WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_set.status = 'ENABLED'`,
    sharedCriteria: `SELECT shared_set.resource_name, shared_criterion.resource_name, shared_criterion.keyword.text,
      shared_criterion.keyword.match_type FROM shared_criterion
      WHERE shared_set.status = 'ENABLED' AND shared_criterion.type = 'KEYWORD'`,
    campaignSharedSets: `SELECT campaign.resource_name, campaign_shared_set.shared_set FROM campaign_shared_set
      WHERE campaign_shared_set.status = 'ENABLED'`,
    assets: `SELECT asset.resource_name, asset.type, asset.name, asset.final_urls, asset.sitelink_asset.link_text,
      asset.sitelink_asset.description1, asset.sitelink_asset.description2, asset.callout_asset.callout_text,
      asset.structured_snippet_asset.header, asset.structured_snippet_asset.values, asset.call_asset.country_code,
      asset.call_asset.phone_number, asset.call_asset.call_conversion_reporting_state,
      asset.call_asset.ad_schedule_targets
      FROM asset WHERE asset.type IN ('SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET', 'IMAGE', 'CALL')`,
    businessName: `SELECT asset.resource_name FROM asset
      WHERE asset.type = 'TEXT' AND asset.text_asset.text = ${gaqlString(plan.businessName)}`,
    campaignAssets: `SELECT campaign.resource_name, campaign_asset.resource_name, campaign_asset.asset,
      campaign_asset.field_type, campaign_asset.source FROM campaign_asset WHERE campaign_asset.status != 'REMOVED'`,
    customerAssets: `SELECT customer_asset.resource_name, customer_asset.asset, customer_asset.field_type,
      customer_asset.source FROM customer_asset WHERE customer_asset.status != 'REMOVED'`,
  };
}

const adSignature = (finalUrl: string, headlines: string[], descriptions: string[], path1 = "", path2 = "") =>
  JSON.stringify([finalUrl, [...headlines].sort(), [...descriptions].sort(), path1, path2]);

/** Nationale Ziffernfolge, damit „0511 …“ und „+49 511 …“ als gleich gelten. */
const phoneDigits = (phone: string, countryCode: string) => {
  const digits = phone.replace(/\D/g, "");
  return countryCode === "DE" && digits.startsWith("49") && !phone.trim().startsWith("0") ? `0${digits.slice(2)}` : digits;
};
const scheduleKey = (targets: Array<{ day: string; start: number; end: number }>) =>
  targets.map((t) => `${t.day}@${t.start}-${t.end}`).sort().join(",");
const callKey = (country: string, phone: string, reporting: string, schedule: string) =>
  `${country}|${phoneDigits(phone, country)}|${reporting}|${schedule}`;
const CALL_REPORTING = "DISABLED";

async function loadLive(client: GoogleAdsClient, plan: AccountPlan): Promise<LiveState> {
  const campaignRows = await client.search(
    "SELECT campaign.resource_name, campaign.name FROM campaign WHERE campaign.status != 'REMOVED'",
  );
  const queries = liveQueries(plan);
  const keys = Object.keys(queries) as Array<keyof typeof queries>;
  const results = await Promise.all(keys.map((k) => client.search(queries[k])));
  const rows = Object.fromEntries(keys.map((k, i) => [k, results[i]])) as Record<keyof typeof queries, GadsRow[]>;

  const live: LiveState = {
    campaigns: new Map(campaignRows.map((r) => [str(obj(r.campaign).name), str(obj(r.campaign).resourceName)])),
    adGroups: new Map(),
    keywords: new Map(),
    ads: [],
    adsByGroup: new Map(),
    campaignCriteria: new Set(),
    campaignNegatives: new Map(),
    sharedSets: new Map(),
    sharedCriteria: new Map(),
    campaignSharedSets: new Set(),
    sitelinkAssets: new Map(),
    calloutAssets: new Map(),
    snippetAssets: new Map(),
    imageAssets: new Map(),
    callAssets: new Map(),
    businessNameAsset: str(obj(rows.businessName[0]?.asset).resourceName) || undefined,
    campaignLinks: new Map(),
    customerLinks: [],
    userLists: new Map(),
    campaignUserLists: new Map(),
  };
  for (const r of rows.userLists) {
    const u = obj(r.userList);
    if (!str(u.name).startsWith(REMARKETING_PREFIX)) continue;
    const flexible = obj(obj(u.ruleBasedUserList).flexibleRuleUserList);
    live.userLists.set(str(u.name), {
      resourceName: str(u.resourceName),
      rules: ruleSignature(liveRuleItems(flexible.inclusiveOperands), liveRuleItems(flexible.exclusiveOperands)),
    });
  }
  for (const r of rows.adGroups) {
    live.adGroups.set(`${str(obj(r.campaign).resourceName)}|${str(obj(r.adGroup).name)}`, str(obj(r.adGroup).resourceName));
  }
  for (const r of rows.keywords) {
    const c = obj(r.adGroupCriterion);
    live.keywords.set(`${str(obj(r.adGroup).resourceName)}|${kwKey(obj(c.keyword))}`, str(c.resourceName));
  }
  for (const r of rows.ads) {
    const aga = obj(r.adGroupAd);
    const ad = obj(aga.ad);
    const rsa = obj(ad.responsiveSearchAd);
    const agRn = str(obj(r.adGroup).resourceName);
    const texts = (v: unknown) => arr(v).map((t) => str(obj(t).text));
    live.ads.push({
      campaign: str(obj(r.campaign).name),
      adGroup: str(obj(r.adGroup).name),
      status: str(aga.status),
      approval: str(obj(aga.policySummary).approvalStatus),
      strength: str(aga.adStrength),
    });
    const list = live.adsByGroup.get(agRn) ?? [];
    list.push({
      resourceName: str(aga.resourceName),
      signature: adSignature(str(arr(ad.finalUrls)[0]), texts(rsa.headlines), texts(rsa.descriptions), str(rsa.path1), str(rsa.path2)),
    });
    live.adsByGroup.set(agRn, list);
  }
  for (const r of rows.criteria) {
    const c = obj(r.campaignCriterion);
    const camp = str(obj(r.campaign).resourceName);
    if (c.type === "KEYWORD" && c.negative === true) live.campaignNegatives.set(`${camp}|${kwKey(obj(c.keyword))}`, str(c.resourceName));
    if (c.type === "LOCATION") live.campaignCriteria.add(`${camp}|geo|${str(obj(c.location).geoTargetConstant)}`);
    if (c.type === "LANGUAGE") live.campaignCriteria.add(`${camp}|lang|${str(obj(c.language).languageConstant)}`);
    if (c.type === "USER_INTEREST") {
      live.campaignCriteria.add(`${camp}|ui|${str(obj(c.userInterest).userInterestCategory)}`);
    }
    if (c.type === "USER_LIST" && c.negative !== true) {
      live.campaignUserLists.set(`${camp}|${str(obj(c.userList).userList)}`, str(c.resourceName));
    }
  }
  for (const r of rows.sharedSets) live.sharedSets.set(str(obj(r.sharedSet).name), str(obj(r.sharedSet).resourceName));
  for (const r of rows.sharedCriteria) {
    const c = obj(r.sharedCriterion);
    live.sharedCriteria.set(`${str(obj(r.sharedSet).resourceName)}|${kwKey(obj(c.keyword))}`, str(c.resourceName));
  }
  for (const r of rows.campaignSharedSets) {
    live.campaignSharedSets.add(`${str(obj(r.campaign).resourceName)}|${str(obj(r.campaignSharedSet).sharedSet)}`);
  }
  for (const r of rows.assets) {
    const a = obj(r.asset);
    const rn = str(a.resourceName);
    if (a.type === "SITELINK") {
      const s = obj(a.sitelinkAsset);
      live.sitelinkAssets.set(`${str(s.linkText)}|${str(s.description1)}|${str(s.description2)}|${str(arr(a.finalUrls)[0])}`, rn);
    }
    if (a.type === "CALLOUT") live.calloutAssets.set(str(obj(a.calloutAsset).calloutText), rn);
    if (a.type === "STRUCTURED_SNIPPET") {
      const s = obj(a.structuredSnippetAsset);
      live.snippetAssets.set(`${str(s.header)}|${arr(s.values).join("|")}`, rn);
    }
    if (a.type === "IMAGE" && str(a.name)) live.imageAssets.set(str(a.name), rn);
    if (a.type === "CALL") {
      const c = obj(a.callAsset);
      const schedule = arr(c.adScheduleTargets).map((t) => {
        const s = obj(t);
        return { day: str(s.dayOfWeek), start: Number(s.startHour ?? 0), end: Number(s.endHour ?? 0) };
      });
      live.callAssets.set(callKey(str(c.countryCode), str(c.phoneNumber), str(c.callConversionReportingState), scheduleKey(schedule)), rn);
    }
  }
  for (const r of rows.campaignAssets) {
    const ca = obj(r.campaignAsset);
    if (ca.source === "AUTOMATICALLY_CREATED") continue;
    const camp = str(obj(r.campaign).resourceName);
    const list = live.campaignLinks.get(camp) ?? [];
    list.push({ resourceName: str(ca.resourceName), asset: str(ca.asset), fieldType: str(ca.fieldType) });
    live.campaignLinks.set(camp, list);
  }
  for (const r of rows.customerAssets) {
    const ca = obj(r.customerAsset);
    if (ca.source === "AUTOMATICALLY_CREATED") continue;
    live.customerLinks.push({ resourceName: str(ca.resourceName), asset: str(ca.asset), fieldType: str(ca.fieldType) });
  }
  return live;
}

function biddingResource(b: CampaignPlan["bidding"]): Obj {
  if (b.type === "MAXIMIZE_CONVERSIONS") {
    return { maximizeConversions: b.targetCpaEur ? { targetCpaMicros: micros(b.targetCpaEur) } : {} };
  }
  if (b.type === "MAXIMIZE_CLICKS") return { targetSpend: { cpcBidCeilingMicros: micros(b.cpcCeilingEur) } };
  return {
    targetImpressionShare: {
      location: "ABSOLUTE_TOP_OF_PAGE",
      locationFractionMicros: String(Math.round(b.absoluteTopShare * 1_000_000)),
      cpcBidCeilingMicros: micros(b.cpcCeilingEur),
    },
  };
}

function campaignResource(c: CampaignPlan, resourceName: string, budget: string): Obj {
  const bidding = biddingResource(c.bidding);
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

const ruleSignature = (inclusive: string[], exclusive: string[]) => JSON.stringify([[...inclusive].sort(), [...exclusive].sort()]);
const planRuleSignature = (l: RemarketingListPlan) =>
  ruleSignature(l.visited.map((v) => `${v}@${l.lifespanDays}`), l.notVisited.map((v) => `${v}@${l.lifespanDays}`));
/** Operanden wie im Plan: „Wert@Tage“ für URL enthält, andere Regeln mit Operator. */
const liveRuleItems = (operands: unknown) =>
  arr(operands).flatMap((o) => {
    const days = String(obj(o).lookbackWindowDays ?? "");
    return arr(obj(obj(o).rule).ruleItemGroups)
      .flatMap((g) => arr(obj(g).ruleItems))
      .map((i) => {
        const item = obj(i);
        const rule = obj(item.stringRuleItem);
        const value = item.name === "url__" && rule.operator === "CONTAINS"
          ? str(rule.value)
          : `${str(item.name)}:${str(rule.operator)}:${str(rule.value)}`;
        return `${value}@${days}`;
      });
  });

/**
 * Eine Seite je Operand: Google lehnt mehrere Regelgruppen in einem Operanden
 * ab (TOO_MANY). Die Dauer steht am Operanden (lookback_window_days), weil
 * Google membership_life_span bei regelbasierten Listen ignoriert.
 */
const urlOperand = (value: string, days: number) => ({
  rule: { ruleItemGroups: [{ ruleItems: [{ name: "url__", stringRuleItem: { operator: "CONTAINS", value } }] }] },
  lookbackWindowDays: String(days),
});

const flexibleRules = (l: RemarketingListPlan) => ({
  inclusiveRuleOperator: "OR",
  inclusiveOperands: l.visited.map((v) => urlOperand(v, l.lifespanDays)),
  exclusiveOperands: l.notVisited.map((v) => urlOperand(v, l.lifespanDays)),
});

function userListResource(l: RemarketingListPlan): Obj {
  return {
    name: l.name,
    description: l.description,
    membershipStatus: "OPEN",
    ruleBasedUserList: { prepopulationStatus: "REQUESTED", flexibleRuleUserList: flexibleRules(l) },
  };
}

class Batch {
  operations: Obj[] = [];
  /** Beschriftung je Operation, damit Google-Fehler (mutate_operations[i]) lesbar werden. */
  labels: string[] = [];
  counts: Record<string, number> = {};
  removals: string[] = [];

  add(kind: string, label: string, operation: Obj) {
    this.operations.push(operation);
    this.labels.push(label);
    this.counts[kind] = (this.counts[kind] ?? 0) + 1;
  }

  remove(kind: string, label: string, operation: Obj) {
    this.add(`removed.${kind}`, label, operation);
    this.removals.push(label);
  }
}

export interface ImageUpload {
  data: string;
  bytes: number;
  mime: "image/jpeg" | "image/png";
  width: number;
  height: number;
}

interface Planned {
  /** lists: neue Remarketing-Listen, laufen vor main (ihre IDs taugen nicht als temporäre Verweise). */
  batches: { lists: Batch; main: Batch; brand: Batch; images: Batch };
  created: string[];
  warnings: string[];
}

function planOperations(
  plan: AccountPlan,
  live: LiveState,
  customerId: string,
  uploads: Map<string, ImageUpload>,
): Planned {
  let nextId = -1;
  const temp = (collection: string) => `customers/${customerId}/${collection}/${nextId--}`;
  const main = new Batch();
  const brand = new Batch();
  const images = new Batch();
  const lists = new Batch();
  const out: Planned = { batches: { lists, main, brand, images }, created: [], warnings: [] };
  const url = (path: string) => `${plan.site}${path}`;
  const keyword = (k: Keyword) => ({ text: k.text, matchType: k.match });
  const customerLinked = (asset: string, field: string) =>
    live.customerLinks.some((l) => l.asset === asset && l.fieldType === field);

  /**
   * Asset anlegen, sofern es im Konto fehlt; innerhalb eines Pakets nur einmal.
   * Temporäre IDs gelten nur im eigenen Request, daher ein Cache je Paket.
   */
  const created = new Map<Batch, Map<string, string>>();
  const assetOnce = (batch: Batch, known: string | undefined, label: string, create: Obj) => {
    if (known) return known;
    const cache = created.get(batch) ?? new Map<string, string>();
    created.set(batch, cache);
    const hit = cache.get(label);
    if (hit) return hit;
    const rn = temp("assets");
    batch.add("assets", label, { assetOperation: { create: { resourceName: rn, ...create } } });
    cache.set(label, rn);
    return rn;
  };

  const callout = (text: string) =>
    assetOnce(main, live.calloutAssets.get(text), `Callout „${text}“`, { calloutAsset: { calloutText: text } });
  const sitelink = (key: string) => {
    const s = plan.sitelinks.find((x) => x.key === key)!;
    return assetOnce(main, live.sitelinkAssets.get(`${s.text}|${s.description1}|${s.description2}|${url(s.path)}`),
      `Sitelink „${s.text}“`, {
        finalUrls: [url(s.path)],
        sitelinkAsset: { linkText: s.text, description1: s.description1, description2: s.description2 },
      });
  };
  const image = (batch: Batch, file: string) => {
    const upload = uploads.get(file);
    return assetOnce(batch, live.imageAssets.get(imageAssetName(file)), `Bild ${file}`, {
      name: imageAssetName(file),
      type: "IMAGE",
      imageAsset: {
        data: upload?.data ?? "",
        fileSize: String(upload?.bytes ?? 0),
        mimeType: upload?.mime === "image/png" ? "IMAGE_PNG" : "IMAGE_JPEG",
        fullSize: { widthPixels: String(upload?.width ?? 0), heightPixels: String(upload?.height ?? 0) },
      },
    });
  };

  // Kontoebene: Callouts, Snippets, Anruf (main); Firmenname und Logo (brand)
  const wantedCustomer = new Map<string, Set<string>>([...MANAGED_CUSTOMER_FIELDS].map((f) => [f, new Set<string>()]));
  const linkCustomer = (batch: Batch, asset: string, field: string, label: string) => {
    wantedCustomer.get(field)!.add(asset);
    if (!customerLinked(asset, field)) {
      batch.add("accountAssetLinks", `${label} verknüpfen`, { customerAssetOperation: { create: { asset, fieldType: field } } });
    }
  };
  for (const text of plan.callouts) linkCustomer(main, callout(text), "CALLOUT", `Callout „${text}“`);
  for (const s of plan.snippets) {
    const rn = assetOnce(main, live.snippetAssets.get(`${s.header}|${s.values.join("|")}`),
      `Snippet „${s.header}“`, { structuredSnippetAsset: { header: s.header, values: s.values } });
    linkCustomer(main, rn, "STRUCTURED_SNIPPET", `Snippet „${s.header}“`);
  }
  const call = plan.call;
  const schedule = call.days.map((day) => ({ day, start: call.startHour, end: call.endHour }));
  const callRn = assetOnce(main, live.callAssets.get(callKey(call.countryCode, call.phone, CALL_REPORTING, scheduleKey(schedule))),
    `Anruf ${call.phone}`, {
      callAsset: {
        countryCode: call.countryCode,
        phoneNumber: call.phone,
        callConversionReportingState: CALL_REPORTING,
        adScheduleTargets: call.days.map((day) => ({
          dayOfWeek: day,
          startHour: call.startHour,
          startMinute: "ZERO",
          endHour: call.endHour,
          endMinute: "ZERO",
        })),
      },
    });
  linkCustomer(main, callRn, "CALL", `Anruf ${call.phone}`);
  const nameRn = assetOnce(brand, live.businessNameAsset, `Firmenname „${plan.businessName}“`, {
    textAsset: { text: plan.businessName },
  });
  linkCustomer(brand, nameRn, "BUSINESS_NAME", `Firmenname „${plan.businessName}“`);
  linkCustomer(brand, image(brand, plan.logo), "BUSINESS_LOGO", `Logo ${plan.logo}`);
  for (const l of live.customerLinks) {
    if (!MANAGED_CUSTOMER_FIELDS.has(l.fieldType) || wantedCustomer.get(l.fieldType)!.has(l.asset)) continue;
    const batch = BRAND_FIELDS.has(l.fieldType) ? brand : main;
    batch.remove("accountAssetLinks", `Konto: ${l.fieldType} ${l.asset} lösen`, { customerAssetOperation: { remove: l.resourceName } });
  }

  // Ausschlussliste
  const list = plan.sharedNegativeList;
  let sharedRn = live.sharedSets.get(list.name);
  if (!sharedRn) {
    sharedRn = temp("sharedSets");
    main.add("sharedNegativeLists", `Liste „${list.name}“`, {
      sharedSetOperation: { create: { resourceName: sharedRn, name: list.name, type: "NEGATIVE_KEYWORDS" } },
    });
    out.created.push(`Ausschlussliste „${list.name}“`);
  }
  const wantedShared = new Set(list.keywords.map((k) => `${sharedRn}|${kwKey(k)}`));
  for (const k of list.keywords) {
    if (!live.sharedCriteria.has(`${sharedRn}|${kwKey(k)}`)) {
      main.add("sharedNegatives", `Listen-Ausschluss „${k.text}“`, {
        sharedCriterionOperation: { create: { sharedSet: sharedRn, keyword: keyword(k) } },
      });
    }
  }
  for (const [key, rn] of live.sharedCriteria) {
    if (key.startsWith(`${sharedRn}|`) && !wantedShared.has(key)) {
      main.remove("sharedNegatives", `Listen-Ausschluss „${key.split("|")[1]}“`, { sharedCriterionOperation: { remove: rn } });
    }
  }

  // Remarketing-Listen: anlegen (Paket lists) bzw. Regeln angleichen
  const userListRns: Array<string | undefined> = [];
  for (const l of plan.remarketingLists) {
    const existing = live.userLists.get(l.name);
    if (!existing) {
      lists.add("remarketingLists", `Remarketing „${l.name}“`, { userListOperation: { create: userListResource(l) } });
      out.created.push(`Remarketing-Liste „${l.name}“`);
      userListRns.push(undefined);
      continue;
    }
    if (existing.rules !== planRuleSignature(l)) {
      main.add("remarketingLists", `Remarketing „${l.name}“: Regeln angleichen`, {
        userListOperation: {
          update: { resourceName: existing.resourceName, ruleBasedUserList: { flexibleRuleUserList: flexibleRules(l) } },
          updateMask: "rule_based_user_list.flexible_rule_user_list",
        },
      });
    }
    userListRns.push(existing.resourceName);
  }
  const wantedUserLinks = new Set<string>();

  for (const c of plan.campaigns) {
    let campRn = live.campaigns.get(c.name);
    const isNew = !campRn;
    if (!campRn) {
      const budgetRn = temp("campaignBudgets");
      campRn = temp("campaigns");
      main.add("budgets", `Budget ${c.name}`, {
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
      main.add("campaigns", `Kampagne ${c.name}`, { campaignOperation: { create: campaignResource(c, campRn, budgetRn) } });
      out.created.push(`Kampagne „${c.name}“ (pausiert, ${c.dailyBudgetEur} €/Tag)`);
    }
    for (const geo of plan.geoTargetConstants) {
      if (!live.campaignCriteria.has(`${campRn}|geo|${geo}`)) {
        main.add("locations", `${c.name}: Ort ${geo}`, {
          campaignCriterionOperation: { create: { campaign: campRn, location: { geoTargetConstant: geo } } },
        });
      }
    }
    for (const lang of plan.languageConstants) {
      if (!live.campaignCriteria.has(`${campRn}|lang|${lang}`)) {
        main.add("languages", `${c.name}: Sprache ${lang}`, {
          campaignCriterionOperation: { create: { campaign: campRn, language: { languageConstant: lang } } },
        });
      }
    }
    if (c.observeAudiences) {
      for (const id of plan.audienceUserInterestIds) {
        const category = `customers/${customerId}/userInterests/${id}`;
        if (!live.campaignCriteria.has(`${campRn}|ui|${category}`)) {
          main.add("audiences", `${c.name}: Zielgruppe ${id}`, {
            campaignCriterionOperation: { create: { campaign: campRn, userInterest: { userInterestCategory: category } } },
          });
        }
      }
      plan.remarketingLists.forEach((l, i) => {
        const listRn = userListRns[i];
        if (!listRn) return;
        wantedUserLinks.add(`${campRn}|${listRn}`);
        if (!live.campaignUserLists.has(`${campRn}|${listRn}`)) {
          main.add("remarketingLinks", `${c.name}: Remarketing „${l.name}“`, {
            campaignCriterionOperation: { create: { campaign: campRn, userList: { userList: listRn } } },
          });
        }
      });
    }
    const wantedNegatives = new Set(c.negatives.map((n) => `${campRn}|${kwKey(n)}`));
    for (const n of c.negatives) {
      if (!live.campaignNegatives.has(`${campRn}|${kwKey(n)}`)) {
        main.add("campaignNegatives", `${c.name}: Ausschluss „${n.text}“`, {
          campaignCriterionOperation: { create: { campaign: campRn, negative: true, keyword: keyword(n) } },
        });
      }
    }
    for (const [key, rn] of live.campaignNegatives) {
      if (key.startsWith(`${campRn}|`) && !wantedNegatives.has(key)) {
        main.remove("campaignNegatives", `${c.name}: Ausschluss „${key.split("|")[1]}“`, { campaignCriterionOperation: { remove: rn } });
      }
    }
    if (c.useSharedNegatives && !live.campaignSharedSets.has(`${campRn}|${sharedRn}`)) {
      main.add("sharedListLinks", `${c.name}: Ausschlussliste`, {
        campaignSharedSetOperation: { create: { campaign: campRn, sharedSet: sharedRn } },
      });
    }

    // Kampagnenebene: Sitelinks und Callouts (main), Bilder (images)
    const links = live.campaignLinks.get(campRn) ?? [];
    const wanted = new Map<string, Set<string>>([...MANAGED_CAMPAIGN_FIELDS].map((f) => [f, new Set<string>()]));
    const linkCampaign = (batch: Batch, asset: string, field: string, label: string) => {
      wanted.get(field)!.add(asset);
      if (!links.some((l) => l.asset === asset && l.fieldType === field)) {
        batch.add(`${field.toLowerCase()}Links`, `${c.name}: ${label}`, {
          campaignAssetOperation: { create: { campaign: campRn, asset, fieldType: field } },
        });
      }
    };
    for (const key of c.sitelinks) linkCampaign(main, sitelink(key), "SITELINK", `Sitelink ${key}`);
    for (const text of c.callouts) linkCampaign(main, callout(text), "CALLOUT", `Callout „${text}“`);
    if (isNew) {
      out.warnings.push(`${c.name}: Bilder erst nach dem Anlegen der Kampagne (erneut "apply").`);
    } else {
      for (const file of c.images) linkCampaign(images, image(images, file), "AD_IMAGE", `Bild ${file}`);
    }
    for (const l of links) {
      if (!MANAGED_CAMPAIGN_FIELDS.has(l.fieldType) || wanted.get(l.fieldType)!.has(l.asset)) continue;
      if (l.fieldType === "AD_IMAGE" && isNew) continue;
      const batch = l.fieldType === "AD_IMAGE" ? images : main;
      batch.remove(`${l.fieldType.toLowerCase()}Links`, `${c.name}: ${l.fieldType} ${l.asset} lösen`, {
        campaignAssetOperation: { remove: l.resourceName },
      });
    }

    for (const ag of c.adGroups) {
      const where = `${c.name} › ${ag.name}`;
      let agRn = live.adGroups.get(`${campRn}|${ag.name}`);
      if (!agRn) {
        agRn = temp("adGroups");
        main.add("adGroups", where, {
          adGroupOperation: {
            create: { resourceName: agRn, campaign: campRn, name: ag.name, status: "ENABLED", type: "SEARCH_STANDARD" },
          },
        });
        out.created.push(`Anzeigengruppe „${where}“`);
      }
      const wantedKeywords = new Set(ag.keywords.map((k) => `${agRn}|${kwKey(k)}`));
      for (const k of ag.keywords) {
        if (!live.keywords.has(`${agRn}|${kwKey(k)}`)) {
          main.add("keywords", `${where}: Keyword „${k.text}“ (${k.match})`, {
            adGroupCriterionOperation: { create: { adGroup: agRn, status: "ENABLED", keyword: keyword(k) } },
          });
        }
      }
      for (const [key, rn] of live.keywords) {
        if (key.startsWith(`${agRn}|`) && !wantedKeywords.has(key)) {
          main.remove("keywords", `${where}: Keyword „${key.split("|").slice(1).join(" ")}“`, {
            adGroupCriterionOperation: { remove: rn },
          });
        }
      }

      const signature = adSignature(url(ag.finalPath), ag.ad.headlines, ag.ad.descriptions, ag.ad.path1, ag.ad.path2);
      const liveAds = live.adsByGroup.get(agRn) ?? [];
      const current = liveAds.find((a) => a.signature === signature);
      for (const a of liveAds) {
        if (a !== current) main.remove("ads", `${where}: alte Anzeige`, { adGroupAdOperation: { remove: a.resourceName } });
      }
      if (!current) {
        main.add("ads", `${where}: Anzeige`, {
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

  const ownLists = new Map([...live.userLists].map(([name, l]) => [l.resourceName, name]));
  for (const [key, rn] of live.campaignUserLists) {
    const listRn = key.slice(key.indexOf("|") + 1);
    if (!ownLists.has(listRn) || wantedUserLinks.has(key)) continue;
    main.remove("remarketingLinks", `Remarketing „${ownLists.get(listRn)}“ von ${key.split("|")[0]} lösen`, {
      campaignCriterionOperation: { remove: rn },
    });
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Lädt nur Bilder, die im Konto noch fehlen, von der eigenen Website und prüft Format und Maße. */
async function loadUploads(plan: AccountPlan, live: LiveState): Promise<Map<string, ImageUpload>> {
  const uploads = new Map<string, ImageUpload>();
  for (const image of plan.images) {
    if (live.imageAssets.has(imageAssetName(image.file))) continue;
    const resp = await fetch(`${plan.site}/ads/${image.file}`, { signal: AbortSignal.timeout(20_000) });
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const info = imageInfo(bytes);
    if (!resp.ok || !info || !imageFits(image.format, info.width, info.height) || bytes.length > IMAGE_MAX_BYTES) {
      throw new Error(`Bild ${image.file}: HTTP ${resp.status}, ${info ? `${info.width}×${info.height}` : "kein JPEG/PNG"} – erst deployen?`);
    }
    uploads.set(image.file, { data: toBase64(bytes), bytes: bytes.length, ...info });
  }
  return uploads;
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

async function runBatch(client: GoogleAdsClient, batch: Batch, mode: "validate" | "apply") {
  const summary = { operations: batch.operations.length, counts: batch.counts, removals: batch.removals };
  if (batch.operations.length === 0) return { ok: true, ...summary, response: undefined };
  try {
    const response: unknown = await client.mutate("googleAds", {
      mutateOperations: batch.operations,
      partialFailure: false,
      validateOnly: mode === "validate",
    });
    return { ok: true, ...summary, applied: mode === "apply", response };
  } catch (err) {
    return { ok: false, ...summary, ...describeFailure(err, batch.labels), response: undefined };
  }
}

export async function runCampaigns(client: GoogleAdsClient, body: Obj) {
  const mode = body.mode === "apply" || body.mode === "validate" ? body.mode : "plan";
  const planErrors = validatePlan(KW_ADS_PLAN);
  if (planErrors.length) return { ok: false, mode, planErrors };

  const all = ["main", "brand", "images"] as const;
  const selected = Array.isArray(body.batches) ? all.filter((k) => (body.batches as unknown[]).includes(k)) : [...all];
  if (selected.length === 0) throw new HttpError(400, `batches: ${all.join(", ")}`, "invalid_input");
  const names = mode === "plan" ? [...all] : selected;

  const live = await loadLive(client, KW_ADS_PLAN);
  const needsImages = names.some((k) => k !== "main");
  const uploads = mode === "plan" || !needsImages ? new Map<string, ImageUpload>() : await loadUploads(KW_ADS_PLAN, live);
  let planned = planOperations(KW_ADS_PLAN, live, client.customerId, uploads);
  // Neue Remarketing-Listen gehören zu „main“ und laufen davor.
  const steps: Array<keyof Planned["batches"]> = names.includes("main") ? ["lists", ...names] : [...names];
  const total = steps.reduce((n, k) => n + planned.batches[k].operations.length, 0);
  const warnings = [...planned.warnings];
  if (steps.includes("lists") && planned.batches.lists.operations.length) {
    warnings.push("Neue Remarketing-Listen werden zuerst angelegt, ihre Kampagnen-Verknüpfungen plant apply direkt danach.");
  }
  const base = { mode, operations: total, created: planned.created, warnings };
  if (mode === "plan" || total === 0) {
    const batches = Object.fromEntries(steps.map((k) => {
      const b = planned.batches[k];
      return [k, { operations: b.operations.length, counts: b.counts, removals: b.removals }];
    }));
    return { ok: true, ...base, upToDate: total === 0, batches, ads: live.ads };
  }
  const batches: Record<string, unknown> = {};
  let ok = true;
  for (const k of steps) {
    const { response, ...result } = await runBatch(client, planned.batches[k], mode);
    batches[k] = result;
    ok &&= result.ok;
    if (k === "lists" && mode === "apply" && result.ok && result.operations > 0) {
      registerCreatedLists(planned.batches.lists, response, live);
      planned = planOperations(KW_ADS_PLAN, live, client.customerId, uploads);
    }
  }
  return { ok, ...base, batches };
}

/** Ressourcennamen aus der Mutate-Antwort, damit die Verknüpfung nicht auf die Suche wartet. */
function registerCreatedLists(batch: Batch, response: unknown, live: LiveState) {
  const results = arr(obj(response).mutateOperationResponses);
  batch.operations.forEach((op, i) => {
    const create = obj(obj(op.userListOperation).create);
    const plan = KW_ADS_PLAN.remarketingLists.find((l) => l.name === create.name);
    const resourceName = str(obj(obj(results[i]).userListResult).resourceName);
    if (!plan || !resourceName) return;
    live.userLists.set(plan.name, { resourceName, rules: planRuleSignature(plan) });
  });
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
      const planCeiling = "cpcCeilingEur" in plan.bidding ? plan.bidding.cpcCeilingEur : undefined;
      const eur = eurInRange(body.cpcCeilingEur ?? planCeiling, 0.1, 50, "cpcCeilingEur");
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
