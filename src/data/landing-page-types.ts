import type { FAQItem } from "@/components/FAQSection";

export interface ContentSection {
  title: string;
  content: string;
  ctaText?: string;
  ctaHref?: string;
  items?: { title: string; description: string }[];
}

export interface LandingPageConfig {
  slug: string;
  path: string;
  title: string;
  metaDescription: string;
  keywords: string;
  h1: string;
  heroSubtitle: string;
  primaryCta: { text: string; href: string };
  secondaryCta: { text: string; href: string };
  sections: ContentSection[];
  faqItems: FAQItem[];
  relatedSlugs: string[];
}
