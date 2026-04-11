import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Helmet } from "react-helmet-async";
import { useSettings } from "@/contexts/SettingsContext";
import { useLocation } from "react-router-dom";
import { getCanonicalUrl, injectStructuredData } from "@/lib/seo";
import type { BreadcrumbItem } from "@/lib/seo";

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  ogImage?: string;
  noIndex?: boolean;
  structuredData?: object | object[];
  breadcrumbs?: BreadcrumbItem[] | boolean;
  /** Blendet den Header aus (z.B. im Wizard-Flow) */
  hideHeader?: boolean;
  /** Blendet den Footer aus (z.B. im Wizard-Flow) */
  hideFooter?: boolean;
}

const PageLayout = ({ 
  children, 
  title, 
  description, 
  keywords,
  canonicalPath,
  ogImage,
  noIndex = false,
  structuredData,
  breadcrumbs,
  hideHeader = false,
  hideFooter = false,
}: PageLayoutProps) => {
  const { settings } = useSettings();
  const location = useLocation();
  const siteName = settings?.site_name || 'CaravanWert';
  
  // Use provided canonical path or current location
  const canonical = getCanonicalUrl(canonicalPath || location.pathname);
  const defaultOgImage = 'https://caravanwert.de/og-image.png';
  const ogImageUrl = ogImage || defaultOgImage;

  // Determine if breadcrumbs should be shown
  const showBreadcrumbs = breadcrumbs !== undefined && breadcrumbs !== false;
  const breadcrumbItems = Array.isArray(breadcrumbs) ? breadcrumbs : undefined;
  
  return (
    <>
      <Helmet>
        <title>{title.includes(siteName) ? title : `${title} | ${siteName}`}</title>
        <meta name="description" content={description} />
        {keywords && <meta name="keywords" content={keywords} />}
        
        {/* Robots meta */}
        {noIndex ? (
          <meta name="robots" content="noindex, nofollow" />
        ) : (
          <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        )}
        
        {/* Canonical URL */}
        <link rel="canonical" href={canonical} />
        
        {/* Open Graph tags */}
        <meta property="og:title" content={`${title} | ${siteName}`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:locale" content="de_DE" />
        
        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${title} | ${siteName}`} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta name="twitter:url" content={canonical} />
        
        {/* Structured Data */}
        {structuredData && (
          <script type="application/ld+json">
            {injectStructuredData(structuredData)}
          </script>
        )}
      </Helmet>
      <div className="flex flex-col min-h-screen">
        {!hideHeader && <Header />}
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          {showBreadcrumbs && (
            <div className="container mx-auto px-4 pt-4">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
          )}
          {children}
        </main>
        {!hideFooter && <Footer />}
        <ScrollToTop />
      </div>
    </>
  );
};

export default PageLayout;
