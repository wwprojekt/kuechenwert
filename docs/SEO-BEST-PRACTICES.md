# SEO Best Practices Guide

## Overview

This guide outlines essential SEO practices to ensure optimal search engine performance and avoid common pitfalls that can lead to poor rankings, Google Ads suspensions, or crawler issues.

---

## 1. DOMAIN CANONICALIZATION

### Problem
Multiple domain versions (www/non-www, HTTP/HTTPS) create duplicate content and split SEO authority.

### Solution
**Always implement proper 301 redirects to a single canonical domain.**

#### Nginx Configuration
```nginx
# HTTP → HTTPS redirect for all domains
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://example.com$request_uri;
}

# www → non-www redirect (HTTPS) - if using Coolify
server {
    listen 80 default_server;
    server_name _;
    
    if ($host = 'www.example.com') {
        return 301 https://example.com$request_uri;
    }
}
```

#### Canonical Meta Tags
```typescript
// Always use canonical domain in meta tags
function getCanonicalUrl(): string {
  const url = new URL(window.location.href);
  return `https://example.com${url.pathname}${url.search}${url.hash}`;
}

// Update canonical and Open Graph URLs
updateMetaProperty('og:url', getCanonicalUrl());
updateCanonicalUrl(getCanonicalUrl());
```

#### Expected Results
| URL | Response | Final URL |
|-----|----------|-----------|
| `http://example.com/` | **301** | `https://example.com/` |
| `http://www.example.com/` | **301** | `https://example.com/` |
| `https://www.example.com/` | **301** | `https://example.com/` |
| `https://example.com/` | **200** | ✅ Canonical URL |

---

## 2. INTERNAL LINKING STRUCTURE

### Problem
Pages only accessible via sitemap without internal links have poor SEO performance and are hard for crawlers to discover.

### Solution
**Every page in your sitemap MUST be reachable through internal navigation.**

#### Navigation Requirements

##### Header Navigation
- **Main menu items** for primary pages
- **Dropdown menus** for secondary pages (services, calculators)
- **Mobile navigation** with all important links
- **Logical categorization** (don't exceed 4-5 items per dropdown)

##### Footer Navigation
- **4-column structure** for comprehensive linking
- **Categorized sections**: Services, Products, Calculators, Guides
- **All sitemap pages** represented in footer
- **Balanced column lengths** (aim for 6-10 links per column)

##### Content-Based Linking
- **Related content sections** on all service pages
- **Cross-references** between related services
- **Call-to-action links** within content
- **Breadcrumb navigation** for deep pages

#### Implementation Example
```typescript
// Header dropdown structure
const calculators = [
  { title: "Calculator 1", href: "/rechner/calc1" },
  { title: "Calculator 2", href: "/rechner/calc2" },
  // ... ensure ALL calculator pages are included
];

// Footer navigation
<div>
  <h4>Services</h4>
  <ul>
    {/* Include ALL service pages from sitemap */}
    <li><Link to="/services/service1">Service 1</Link></li>
    <li><Link to="/services/service2">Service 2</Link></li>
  </ul>
</div>
```

#### Validation Checklist
- [ ] Every sitemap URL has at least 1 internal link
- [ ] Navigation menus are not overcrowded
- [ ] Mobile navigation includes all critical pages
- [ ] Related content components link to relevant pages

---

## 3. GOOGLE ADS COMPLIANCE

### Problem
Cloaking violations occur when different content is served to Google crawlers vs users.

### Solution
**Ensure identical content delivery to all visitors, including bots.**

#### Cookie Banner Compliance
```typescript
// WRONG: Blocking content for crawlers
if (!showBanner) return null;
return <div className="fixed inset-0 z-50">Content blocking banner</div>;

// RIGHT: Non-blocking banner with bot detection
useEffect(() => {
  const isBot = /bot|crawler|spider|googlebot|adsbot/i.test(navigator.userAgent);
  if (isBot) {
    console.log('Bot detected, skipping cookie banner');
    return; // Don't show banner to bots
  }
  // Show banner to real users
}, []);

// Non-blocking layout
return (
  <div className="fixed bottom-0 z-50" style={{ pointerEvents: 'none' }}>
    <div style={{ pointerEvents: 'auto' }}>
      {/* Banner content */}
    </div>
  </div>
);
```

#### Robots.txt Best Practices
```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
# CRITICAL: Allow UTM parameters for Google Ads
Allow: /*?*utm_*

# Explicitly allow Google Ads bots
User-agent: AdsBot-Google
Allow: /
Crawl-delay: 1

User-agent: Googlebot-Mobile  
Allow: /
Crawl-delay: 1
```

#### What NOT to Do
- ❌ Different content for different user agents
- ❌ Pop-ups that block content access
- ❌ Redirects that hide landing page content
- ❌ Blocking UTM parameters in robots.txt
- ❌ JavaScript that prevents crawler access

---

## 4. TECHNICAL SEO FUNDAMENTALS

### Meta Tags & Structured Data

#### Essential Meta Tags
```html
<!-- Basic meta tags -->
<title>Page Title - Brand Name</title>
<meta name="description" content="Page description under 160 characters">
<meta name="keywords" content="keyword1, keyword2, keyword3">

<!-- Canonical URL (CRITICAL) -->
<link rel="canonical" href="https://example.com/current-page">

<!-- Open Graph -->
<meta property="og:title" content="Page Title">
<meta property="og:description" content="Page description">
<meta property="og:image" content="https://example.com/image.jpg">
<meta property="og:url" content="https://example.com/current-page">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Page Title">
<meta name="twitter:description" content="Page description">
<meta name="twitter:image" content="https://example.com/image.jpg">
```

#### Structured Data
```typescript
// Service pages
const serviceStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Service Name",
  "description": "Service description",
  "provider": {
    "@type": "Organization",
    "name": "Company Name"
  }
};

// Article pages
const articleStructuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "description": "Article description",
  "author": {
    "@type": "Organization",
    "name": "Company Name"
  }
};
```

### Sitemap Requirements

#### Sitemap Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2025-01-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- Include ALL public pages -->
</urlset>
```

#### Priority Guidelines
- **Homepage**: 1.0
- **Main landing pages**: 0.9 (e.g., /immobilien, /finanzierung)
- **Service pages**: 0.7-0.8
- **Calculator pages**: 0.8
- **Content pages**: 0.6-0.7
- **Legal pages**: 0.3

#### Automated Generation
```javascript
// Generate sitemap dynamically
const staticPages = [
  { loc: `${BASE_URL}/`, priority: 1.0, changefreq: 'daily' },
  { loc: `${BASE_URL}/immobilien`, priority: 0.9, changefreq: 'daily' },
  // ... include ALL pages
];

// Include dynamic content
const properties = await getActiveProperties();
const articles = await getPublishedArticles();
```

---

## 5. CONTENT OPTIMIZATION

### Page Structure

#### Essential Elements
1. **H1 tag** (only one per page)
2. **H2-H6 tags** for proper hierarchy
3. **Meta description** (150-160 characters)
4. **Internal links** to related content
5. **Image alt tags** for all images
6. **Schema markup** for structured data

#### Content Guidelines
- **Unique content** on every page
- **Relevant keywords** naturally integrated
- **Proper heading hierarchy** (H1 → H2 → H3)
- **Internal linking** to related pages
- **External links** to authoritative sources (with nofollow if needed)

### Image Optimization

#### Technical Requirements
```typescript
// Proper image implementation
<LazyImage 
  src="/images/service-image.png"
  alt="Descriptive alt text with keywords"
  className="w-full h-[400px] object-cover"
  loading="lazy"
  quality={90}
  sizes="(max-width: 768px) 100vw, 50vw"
  fallbackSrc="/images/fallback.png"
/>
```

#### Image Guidelines
- **Descriptive alt tags** with relevant keywords
- **Proper file names** (service-name.png, not IMG_001.jpg)
- **Optimized file sizes** (under 100KB for web)
- **Responsive images** with proper sizes attribute
- **Lazy loading** for performance

---

## 6. PERFORMANCE & TECHNICAL

### Core Web Vitals

#### Critical Metrics
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms  
- **CLS (Cumulative Layout Shift)**: < 0.1

#### Optimization Techniques
```typescript
// Code splitting for better loading
const LazyComponent = lazy(() => import('./Component'));

// Image optimization
const optimizedImages = {
  '/page': ['/images/critical-image.png'], // Preload critical images
};

// DNS prefetch for external resources
<link rel="dns-prefetch" href="https://external-api.com">
```

### Security Headers

#### Essential Headers
```
# Security headers for SEO trust
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 7. TRACKING & ANALYTICS

### Consent Management

#### GDPR-Compliant Implementation
```typescript
// Bot-friendly cookie banner
const isBot = /bot|crawler|spider/i.test(navigator.userAgent);
if (isBot) return null; // Don't show to crawlers

// Cross-domain cookie support
const domain = '.example.com'; // Works for both www and non-www
document.cookie = `consent=true; domain=${domain}; path=/; SameSite=Lax; Secure`;
```

#### Tracking Codes
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>

<!-- Click fraud detection -->
<script src="//scripts.clixtell.com/track.js" async></script>

<!-- User behavior tracking -->
<script src="//cdn.mouseflow.com/projects/PROJECT_ID.js" defer></script>
```

---

## 8. CONTENT MANAGEMENT

### Article & Content Strategy

#### SEO-Friendly URLs
```
✅ GOOD: /ratgeber/immobilie-kaufen-2025
❌ BAD:  /article?id=123&category=tips
```

#### Internal Linking Strategy
- **Hub pages** that link to related content
- **Related content sections** on all pages
- **Contextual links** within article content
- **Category pages** that list all related articles

### Dynamic Content

#### Database-Driven SEO
```typescript
// Generate meta tags from database
const article = await getArticle(slug);
const metaTags = {
  title: `${article.title} | ${companyInfo.name}`,
  description: article.excerpt,
  keywords: article.tags,
  canonical: `https://example.com/ratgeber/${article.slug}`
};
```

---

## 9. MONITORING & MAINTENANCE

### Essential Tools

#### Google Tools
- **Google Search Console**: Monitor crawl errors, indexing status
- **Google Analytics**: Track organic traffic and user behavior  
- **PageSpeed Insights**: Monitor Core Web Vitals
- **Mobile-Friendly Test**: Ensure mobile compatibility

#### SEO Auditing
- **Screaming Frog**: Crawl website for technical issues
- **Ahrefs/SEMrush**: Monitor rankings and backlinks
- **GTmetrix**: Performance monitoring
- **Lighthouse**: Comprehensive auditing

### Regular Maintenance Tasks

#### Monthly Checks
- [ ] Verify all sitemap URLs are internally linked
- [ ] Check for broken internal/external links
- [ ] Review Core Web Vitals performance
- [ ] Monitor Google Search Console for issues
- [ ] Verify canonical URLs are consistent

#### After Major Updates
- [ ] Re-crawl website with SEO tools
- [ ] Verify no internal links were broken
- [ ] Check mobile responsiveness
- [ ] Test cookie banner behavior
- [ ] Validate structured data markup

---

## 10. COMMON PITFALLS TO AVOID

### Google Ads Cloaking Issues
❌ **Never Do This:**
- Show different content to crawlers vs users
- Block content with non-dismissible overlays
- Use redirects that hide landing page content
- Block UTM parameters in robots.txt
- Serve different pages based on user agent

✅ **Always Do This:**
- Identical content for all visitors
- Non-blocking cookie banners
- Allow crawler access to all public content
- Include AdsBot-Google in robots.txt
- Test landing pages with Google's tools

### Internal Linking Mistakes
❌ **Avoid:**
- Pages only accessible via sitemap
- Dropdown menus with too many items
- Broken or outdated internal links
- Missing related content sections
- Deep page nesting (>3 clicks from homepage)

✅ **Implement:**
- Every sitemap page has ≥1 internal link
- Balanced navigation menus
- Related content on all pages
- Logical site hierarchy
- Clear navigation paths

### Technical SEO Errors
❌ **Common Issues:**
- Missing canonical tags
- Duplicate meta descriptions
- Images without alt tags
- Slow loading times (>3s)
- Mobile-unfriendly layouts
- Missing structured data

✅ **Best Practices:**
- Unique meta tags for every page
- Optimized images with descriptive alt tags
- Fast loading times (<2s)
- Mobile-first responsive design
- Comprehensive structured data markup

---

## 11. IMPLEMENTATION CHECKLIST

### New Website Launch
- [ ] Domain canonicalization configured
- [ ] Sitemap generated and submitted
- [ ] Robots.txt allows all important crawlers
- [ ] All pages have internal links
- [ ] Meta tags unique and optimized
- [ ] Images optimized with alt tags
- [ ] Structured data implemented
- [ ] Google Analytics/Search Console setup
- [ ] Mobile responsiveness verified
- [ ] Core Web Vitals optimized

### Content Publication
- [ ] SEO-friendly URL structure
- [ ] Unique meta title and description
- [ ] Proper heading hierarchy (H1, H2, H3)
- [ ] Internal links to related content
- [ ] Images with descriptive alt tags
- [ ] Structured data markup
- [ ] Social media meta tags
- [ ] Mobile optimization verified

### Service Page Creation
- [ ] Added to services config
- [ ] Included in navigation menus
- [ ] Added to footer links
- [ ] Related content component included
- [ ] Proper structured data markup
- [ ] Cross-references from related pages
- [ ] Mobile-optimized layout
- [ ] Performance optimized

---

## 12. EMERGENCY TROUBLESHOOTING

### Google Ads Suspension
1. **Identify issue** from suspension email
2. **Check for cloaking** - test with different user agents
3. **Fix cookie banner** - ensure non-blocking for crawlers
4. **Update robots.txt** - allow UTM parameters
5. **Test landing pages** with Google's tools
6. **Wait 24-48 hours** before appeal
7. **Submit appeal** with specific fixes mentioned

### SEO Performance Drop
1. **Check Google Search Console** for crawl errors
2. **Verify internal links** are not broken
3. **Test site speed** and Core Web Vitals
4. **Check for duplicate content** issues
5. **Verify canonical tags** are correct
6. **Review recent changes** that might have caused issues

### Crawler Issues
1. **Check robots.txt** for blocking rules
2. **Verify server response codes** (should be 200 or 301)
3. **Test internal linking** with crawler tools
4. **Check for JavaScript errors** that prevent crawling
5. **Verify sitemap** is accessible and valid

---

## 13. TOOLS & RESOURCES

### Development Tools
- **Screaming Frog**: Website crawler and auditing
- **Google Lighthouse**: Performance and SEO auditing
- **Google PageSpeed Insights**: Core Web Vitals testing
- **Google Mobile-Friendly Test**: Mobile compatibility
- **Rich Results Test**: Structured data validation

### Monitoring Tools
- **Google Search Console**: Crawl monitoring and indexing
- **Google Analytics**: Traffic and user behavior
- **Ahrefs**: Backlink and keyword monitoring
- **SEMrush**: Comprehensive SEO monitoring
- **GTmetrix**: Performance monitoring

### Validation Resources
- **W3C Markup Validator**: HTML validation
- **Schema.org Validator**: Structured data validation
- **XML Sitemap Validator**: Sitemap validation
- **Canonical URL Checker**: Canonicalization verification

---

## 14. SUCCESS METRICS

### Key Performance Indicators
- **Organic traffic growth**: Month-over-month increase
- **Keyword rankings**: Top 10 positions for target keywords
- **Core Web Vitals**: All metrics in green zone
- **Crawl coverage**: 100% of sitemap URLs indexed
- **Internal link distribution**: No orphaned pages
- **Mobile usability**: Zero mobile issues in Search Console

### Reporting Dashboard
- **Weekly**: Core Web Vitals, crawl errors
- **Monthly**: Organic traffic, keyword rankings, internal link audit
- **Quarterly**: Comprehensive SEO audit, competitor analysis

---

## 15. MAINTENANCE SCHEDULE

### Daily (Automated)
- Monitor server uptime and response codes
- Check for new crawl errors in Search Console
- Verify sitemap accessibility

### Weekly
- Review organic traffic trends
- Check for new broken links
- Monitor Core Web Vitals scores

### Monthly
- Comprehensive internal link audit
- Update sitemap with new content
- Review and optimize underperforming pages
- Check competitor SEO strategies

### Quarterly
- Full SEO audit with tools like Screaming Frog
- Review and update meta tags
- Optimize underperforming content
- Plan content strategy for next quarter

---

## CONCLUSION

Following these best practices will ensure:
- ✅ **Strong SEO performance** with proper technical foundation
- ✅ **Google Ads compliance** without cloaking violations  
- ✅ **Excellent user experience** with fast, accessible navigation
- ✅ **Crawler-friendly architecture** for optimal indexing
- ✅ **Future-proof SEO** that scales with website growth

**Remember**: SEO is an ongoing process. Regular monitoring and maintenance are essential for long-term success.
