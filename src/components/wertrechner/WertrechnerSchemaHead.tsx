import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import {
  generateWertrechnerSchema,
  injectStructuredData,
} from "@/lib/seo";
import {
  useWertrechnerReviewStats,
  WERTRECHNER_SCHEMA_MIN_REVIEWS,
} from "@/hooks/useWertrechnerReviewStats";
import { BRAND } from "@/lib/brand";

/**
 * Injects a `WebApplication` JSON-LD schema into the page head for pages
 * where the Wertrechner IS the primary content.
 *
 * Use on: /wertrechner, /wohnmobil-wertermittlung-kostenlos,
 *         /was-ist-mein-wohnmobil-wert, /wieviel-ist-mein-wohnmobil-wert,
 *         /wertermittlung
 *
 * Do NOT use on: Homepage, /verkaufen, /kaufen, /ratgeber, /haendler —
 *   pages whose primary content is NOT the calculator.
 *
 * `aggregateRating` is emitted only once the approved review count reaches
 * `WERTRECHNER_SCHEMA_MIN_REVIEWS` (see hook). Below that, the schema still
 * advertises the WebApplication but without stars.
 *
 * This component uses `@id` = `${BASE_URL}/wertrechner#webapp` so Google
 * treats emissions from multiple landing pages as the same entity (no
 * duplicate-rating problem).
 */
export function WertrechnerSchemaHead() {
  const { stats } = useWertrechnerReviewStats();
  const location = useLocation();

  const pageUrl = `${BRAND.baseUrl}${location.pathname}`;
  const schema = generateWertrechnerSchema({
    pageUrl,
    averageRating: stats.average,
    reviewCount: stats.count,
    minReviews: WERTRECHNER_SCHEMA_MIN_REVIEWS,
  });

  return (
    <Helmet>
      <script type="application/ld+json">{injectStructuredData(schema)}</script>
    </Helmet>
  );
}

export default WertrechnerSchemaHead;
