import type { FAQItem } from "@/components/FAQSection";
import type { ContentSection } from "@/data/landing-page-types";

export interface RatgeberConfig {
  slug: string;
  path: string;
  title: string;
  metaDescription: string;
  keywords: string;
  h1: string;
  heroSubtitle: string;
  category: "brand" | "condition";
  brandName?: string;
  primaryCta: { text: string; href: string };
  secondaryCta: { text: string; href: string };
  sections: ContentSection[];
  faqItems: FAQItem[];
  relatedSlugs: string[];
}
