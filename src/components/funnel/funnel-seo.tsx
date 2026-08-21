import { Helmet } from "react-helmet-async";
import { getCanonicalUrl } from "@/lib/seo";
import { BRAND } from "@/lib/brand/config";

interface FunnelSeoProps {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
}

/** Lightweight Helmet for funnel pages that skip PageLayout chrome. */
export function FunnelSeo({
  title,
  description,
  canonicalPath,
  noIndex = false,
}: FunnelSeoProps) {
  const canonical = getCanonicalUrl(canonicalPath);
  const fullTitle = title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
      )}
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
    </Helmet>
  );
}
