/**
 * SEO Utilities
 * Helper functions for SEO optimization including canonical URLs,
 * structured data generation, and breadcrumb creation
 */

import { BRAND, BRAND_LEGAL } from "@/lib/brand/config";
import { BRAND_ASSET_URLS } from "@/lib/brand/assets";
import { FALLBACK_SUPPORT_PHONE } from "@/hooks/useSupportPhone";

// Base URL for canonical URLs (aus zentraler Brand-Config).
const BASE_URL = BRAND.baseUrl;

const LEGAL_ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: BRAND_LEGAL.street,
  postalCode: BRAND_LEGAL.postalCode,
  addressLocality: BRAND_LEGAL.city,
  addressCountry: 'DE',
} as const;

const SCHEMA_LOGO_URL = BRAND_ASSET_URLS.logoSquare;
const SCHEMA_IMAGE_FALLBACK = BRAND_ASSET_URLS.ogImage;

/**
 * Generate canonical URL for a given path
 */
export function getCanonicalUrl(path: string): string {
  // Remove trailing slash unless it's the root
  const cleanPath = path === '/' ? path : path.replace(/\/$/, '');
  // Remove query parameters for canonical (optional - depends on strategy)
  const pathWithoutQuery = cleanPath.split('?')[0];
  return `${BASE_URL}${pathWithoutQuery}`;
}

/**
 * Organization structured data for the company
 */
export interface OrganizationSchemaSettings {
  site_name?: string;
  site_description?: string;
  support_phone?: string;
  contact_email?: string;
}

export function generateOrganizationSchema(settings?: OrganizationSchemaSettings) {
  const phone = settings?.support_phone?.trim() || FALLBACK_SUPPORT_PHONE;
  const email = settings?.contact_email || BRAND.supportEmail;
  // sameAs erst eintragen, wenn es echte Social-Profile gibt (BRAND.social sind Platzhalter).
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    name: settings?.site_name || BRAND.name,
    legalName: BRAND_LEGAL.company,
    description: settings?.site_description || 'Traumküche im eigenen Raum mit KI visualisieren, Preis schätzen und Angebote geprüfter Küchenstudios vergleichen.',
    url: BASE_URL,
    logo: SCHEMA_LOGO_URL,
    image: SCHEMA_IMAGE_FALLBACK,
    telephone: phone,
    email,
    address: LEGAL_ADDRESS,
    areaServed: {
      '@type': 'Country',
      name: 'Germany',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: phone,
      email,
      contactType: 'Customer Service',
      areaServed: 'DE',
      availableLanguage: 'German',
      hoursAvailable: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '18:00',
      },
    },
  };
}

/**
 * Service structured data
 */
export function generateServiceSchema(serviceName: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: serviceName,
    description: description,
    provider: {
      '@type': 'Organization',
      name: BRAND.name,
      url: BASE_URL,
    },
    areaServed: {
      '@type': 'Country',
      name: 'Germany',
    },
    serviceType: 'Vermittlung von Küchenangeboten',
  };
}

/**
 * Article/BlogPosting structured data
 */
export interface ArticleSchemaData {
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  imageUrl?: string;
  articleSection?: string;
}

export function generateArticleSchema(data: ArticleSchemaData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: data.title,
    description: data.description,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    author: {
      '@type': 'Organization',
      name: data.authorName || BRAND.name,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: {
        '@type': 'ImageObject',
        url: SCHEMA_LOGO_URL,
      },
    },
    image: data.imageUrl || SCHEMA_IMAGE_FALLBACK,
    articleSection: data.articleSection || 'Küchen',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': getCanonicalUrl(window.location.pathname),
    },
  };
}

/**
 * FAQ structured data
 */
export interface FAQItem {
  question: string;
  answer: string;
}

export function generateFAQSchema(items: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * Breadcrumb structured data
 */
export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  };
}

/**
 * Generate breadcrumb items from path
 */
export function getBreadcrumbsFromPath(path: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [{ name: 'Home', path: '/' }];
  
  const pathMap: Record<string, string> = {
    '/kontakt': 'Kontakt',
    '/ratgeber': 'Ratgeber',
    '/ueber-uns': 'Über uns',
    '/haendler': 'Für Küchenstudios',
    '/kuechenstudios': 'Küchenstudios & Showrooms',
    '/projekt': 'Mein Projekt',
    '/faq': 'FAQ',
    '/blog': 'Blog',
    '/impressum': 'Impressum',
    '/datenschutz': 'Datenschutz',
    '/agb': 'AGB',
    '/formular': 'Küchenangebote einholen',
    '/funnel/a': 'Angebote einholen',
    '/funnel/b': 'Fertige Planung vergleichen',
    '/funnel/c': 'KI-Traumküchen-Planer',
    '/preise': 'Preise & Leistungen',
    '/kuechenrechner': 'KüchenRechner',
  };

  // Handle simple paths
  if (pathMap[path]) {
    breadcrumbs.push({ name: pathMap[path], path });
    return breadcrumbs;
  }

  // Handle nested paths
  const segments = path.split('/').filter(Boolean);
  let currentPath = '';
  
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const name = pathMap[currentPath] || segment.replace(/-/g, ' ');
    breadcrumbs.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      path: currentPath,
    });
  }

  return breadcrumbs;
}

/**
 * Helper to inject structured data into page
 */
export function injectStructuredData(data: object | object[]): string {
  const dataArray = Array.isArray(data) ? data : [data];
  return JSON.stringify(dataArray.length === 1 ? dataArray[0] : dataArray);
}

