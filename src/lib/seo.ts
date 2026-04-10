/**
 * SEO Utilities
 * Helper functions for SEO optimization including canonical URLs,
 * structured data generation, and breadcrumb creation
 */

// Base URL for canonical URLs
const BASE_URL = 'https://caravanwert.de';

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
  company_address?: string | null;
  company_city?: string | null;
  company_postal_code?: string | null;
  company_country?: string | null;
}

export function generateOrganizationSchema(settings?: OrganizationSchemaSettings) {
  const phone = settings?.support_phone || '';
  const email = settings?.contact_email || '';
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    name: settings?.site_name || 'CaravanWert',
    description: settings?.site_description || 'Ihre Plattform für den Wohnmobil-Verkauf',
    url: BASE_URL,
    logo: `${BASE_URL}/favicon.png`,
    image: `${BASE_URL}/favicon.png`,
    ...(phone && { telephone: phone }),
    ...(email && { email }),
    ...(settings?.company_address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: settings.company_address,
        addressLocality: settings.company_city || '',
        postalCode: settings.company_postal_code || '',
        addressCountry: 'DE',
      },
    }),
    areaServed: {
      '@type': 'Country',
      name: 'Germany',
    },
    ...(phone && {
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: phone,
        contactType: 'Customer Service',
        areaServed: 'DE',
        availableLanguage: 'German',
      },
    }),
    sameAs: [
      'https://www.facebook.com/caravanwert',
      'https://www.instagram.com/caravanwert',
    ],
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
      name: 'CaravanWert',
      url: BASE_URL,
    },
    areaServed: {
      '@type': 'Country',
      name: 'Germany',
    },
    serviceType: 'Vehicle Trading',
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
      name: data.authorName || 'CaravanWert',
    },
    publisher: {
      '@type': 'Organization',
      name: 'CaravanWert',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/favicon.png`,
      },
    },
    image: data.imageUrl || `${BASE_URL}/favicon.png`,
    articleSection: data.articleSection || 'Wohnmobil',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': window.location.href,
    },
  };
}

/**
 * Product structured data for vehicles/auctions
 */
export interface ProductSchemaData {
  name: string;
  description: string;
  brand: string;
  model: string;
  year?: number;
  price: number;
  currency?: string;
  availability?: string;
  condition?: string;
  imageUrl?: string;
}

export function generateProductSchema(data: ProductSchemaData) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    brand: {
      '@type': 'Brand',
      name: data.brand,
    },
    model: data.model,
    productionDate: data.year?.toString(),
    image: data.imageUrl || `${BASE_URL}/favicon.png`,
    offers: {
      '@type': 'Offer',
      price: data.price,
      priceCurrency: data.currency || 'EUR',
      availability: data.availability || 'https://schema.org/InStock',
      itemCondition: data.condition || 'https://schema.org/UsedCondition',
      seller: {
        '@type': 'Organization',
        name: 'CaravanWert',
      },
    },
  };

  return schema;
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
    '/verkaufen': 'Verkaufen',
    '/kaufen': 'Kaufen',
    '/kontakt': 'Kontakt',
    '/ratgeber': 'Ratgeber',
    '/ueber-uns': 'Über uns',
    '/haendler': 'Für Händler',
    '/ankaufstationen': 'Ankaufstationen',
    '/faq': 'FAQ',
    '/blog': 'Blog',
    '/impressum': 'Impressum',
    '/datenschutz': 'Datenschutz',
    '/agb': 'AGB',
    '/wohnmobil-verkaufen': 'Wohnmobil Verkaufen',
    '/wohnwagen-verkaufen': 'Wohnwagen Verkaufen',
    '/was-ist-mein-wohnmobil-wert': 'Wohnmobil Wert',
    '/wohnmobil-wertermittlung-kostenlos': 'Wertermittlung Kostenlos',
    '/wir-kaufen-dein-wohnmobil': 'Wohnmobil Ankauf',
    '/wieviel-ist-mein-wohnmobil-wert': 'Wohnmobil Wertrechner',
    '/preise': 'Preise & Leistungen',
    '/wertermittlung': 'Wertermittlung',
    '/wertrechner': 'Wertrechner',
    '/verkaufen/wizard': 'Inserat erstellen',
    '/verkaufen/danke': 'Vielen Dank',
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

