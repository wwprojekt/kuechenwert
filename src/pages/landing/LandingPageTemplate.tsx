import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Shield, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { LandingLeadForm } from "@/components/LandingLeadForm";
import FAQSection from "@/components/FAQSection";
import RelatedContent from "@/components/RelatedContent";
import {
  generateServiceSchema,
  generateBreadcrumbSchema,
  getBreadcrumbsFromPath,
} from "@/lib/seo";
import type { LandingPageConfig } from "@/data/landing-page-types";
import { landingPages } from "@/data/landing-pages";
import { WertrechnerSchemaHead } from "@/components/wertrechner/WertrechnerSchemaHead";
import { ReviewStarsBadge } from "@/components/wertrechner/ReviewStarsBadge";

/**
 * Paths of landing pages whose PRIMARY CONTENT is the Wertrechner tool.
 * These pages get the additional `WebApplication` JSON-LD schema with
 * AggregateRating (shared `@id` across all emissions — see seo.ts).
 *
 * DO NOT add paths where the calculator is merely embedded as secondary
 * content. That risks a Google structured-data spam penalty.
 */
const WERTRECHNER_LANDING_PATHS = new Set([
  "/was-ist-mein-wohnmobil-wert",
  "/wohnmobil-wertermittlung-kostenlos",
  "/wieviel-ist-mein-wohnmobil-wert",
]);

interface LandingPageTemplateProps {
  config: LandingPageConfig;
}

const LandingPageTemplate = ({ config }: LandingPageTemplateProps) => {
  const serviceSchema = generateServiceSchema(config.title, config.metaDescription);
  const breadcrumbSchema = generateBreadcrumbSchema(getBreadcrumbsFromPath(config.path));

  const structuredData = [serviceSchema, breadcrumbSchema];
  const isWertrechnerLanding = WERTRECHNER_LANDING_PATHS.has(config.path);

  const relatedLinks = config.relatedSlugs
    .map((slug) => {
      const page = landingPages[slug];
      if (!page) return null;
      return {
        title: page.h1.split("—")[0].trim(),
        description: page.metaDescription.slice(0, 120) + "...",
        href: page.path,
      };
    })
    .filter(Boolean) as { title: string; description: string; href: string }[];

  return (
    <PageLayout
      title={config.title}
      description={config.metaDescription}
      keywords={config.keywords}
      canonicalPath={config.path}
      structuredData={structuredData}
    >
      {/* Wertrechner WebApplication schema — only on calculator landings */}
      {isWertrechnerLanding && <WertrechnerSchemaHead />}

      {/* Hero Section */}
      <PageHero size="lg">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              {config.h1}
            </h1>
            {isWertrechnerLanding && (
              <div className="mb-4">
                <ReviewStarsBadge size="md" variant="full" link linkTo="/wertrechner#reviews" />
              </div>
            )}
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              {config.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                asChild
                size="lg"
                className="gradient-hero hover:gradient-hero-hover h-14 text-lg font-semibold px-8"
              >
                <Link to={config.primaryCta.href}>
                  {config.primaryCta.text}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 text-lg px-8">
                <Link to={config.secondaryCta.href}>
                  {config.secondaryCta.text}
                </Link>
              </Button>
            </div>
          </div>
          <div className="hidden lg:block">
            <LandingLeadForm />
          </div>
        </div>
        {/* Mobile lead form */}
        <div className="lg:hidden mt-10">
          <LandingLeadForm />
        </div>
      </PageHero>

      {/* Content Sections */}
      {config.sections.map((section, idx) => (
        <section
          key={idx}
          className={`py-16 md:py-20 ${idx % 2 === 1 ? "bg-gradient-to-br from-sky-50/60 via-slate-50/40 to-slate-50/20" : "bg-gradient-to-b from-slate-50/20 to-slate-50/30"}`}
        >
          <div className="container max-w-6xl">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{section.title}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {section.content}
              </p>
            </div>

            {section.items && section.items.length > 0 && (
              <div
                className={`grid gap-6 ${
                  section.items.length <= 3
                    ? "md:grid-cols-3"
                    : "md:grid-cols-2 lg:grid-cols-2"
                }`}
              >
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    className="bg-background rounded-xl border p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold mb-2">{item.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {section.ctaText && section.ctaHref && (
              <div className="text-center mt-10">
                <Button
                  asChild
                  size="lg"
                  className="gradient-hero hover:gradient-hero-hover h-12 px-8 text-base font-semibold"
                >
                  <Link to={section.ctaHref}>
                    {section.ctaText}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Trust Signals */}
      <section className="py-16 bg-gradient-to-b from-slate-100/60 to-slate-50/40 border-y">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold">Darauf können Sie sich verlassen</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">SSL-Verschlüsselt</p>
                <p className="text-sm text-muted-foreground">Sichere Übertragung</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Geprüfter Service</p>
                <p className="text-sm text-muted-foreground">Verifizierte Händler</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">24h Bewertung</p>
                <p className="text-sm text-muted-foreground">Schnelle Bearbeitung</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">100% Kostenlos</p>
                <p className="text-sm text-muted-foreground">Keine Gebühren</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection
        items={config.faqItems}
        title="Häufig gestellte Fragen"
        subtitle={`Antworten auf die wichtigsten Fragen zum Thema "${config.h1.split("—")[0].trim()}"`}
      />

      {/* Related Content */}
      {relatedLinks.length > 0 && (
        <RelatedContent
          title="Das könnte Sie auch interessieren"
          links={relatedLinks}
        />
      )}

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
        <div className="container max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Bereit? {config.primaryCta.text}!
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Kostenlos, unverbindlich und in wenigen Minuten erledigt. Starten Sie jetzt und erhalten Sie den besten Preis für Ihr Fahrzeug.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="gradient-hero hover:gradient-hero-hover h-14 text-lg font-semibold px-10"
            >
              <Link to={config.primaryCta.href}>
                {config.primaryCta.text}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 text-lg px-10">
              <Link to={config.secondaryCta.href}>
                {config.secondaryCta.text}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default LandingPageTemplate;
