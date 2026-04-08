import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";

interface RelatedLink {
  title: string;
  description: string;
  href: string;
  icon?: React.ElementType;
}

interface RelatedContentProps {
  title?: string;
  description?: string;
  links: RelatedLink[];
  className?: string;
}

/**
 * Related Content Component
 * Displays related pages/articles for internal linking
 * Critical for SEO - ensures all pages are interconnected
 */
const RelatedContent = ({ 
  title = "Weiterführende Informationen",
  description = "Entdecken Sie weitere hilfreiche Ressourcen",
  links,
  className = ""
}: RelatedContentProps) => {
  return (
    <section className={`py-16 bg-muted/30 ${className}`}>
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {links.map((link, index) => {
            const Icon = link.icon || FileText;
            
            return (
              <Link key={index} to={link.href} className="group">
                <Card className="h-full hover-lift border-2 hover:border-primary/20 transition-all">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="flex items-center justify-between">
                      {link.title}
                      <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="leading-relaxed">
                      {link.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RelatedContent;

/**
 * Predefined related content sets for common pages
 */
export const verkaufenRelatedLinks: RelatedLink[] = [
  {
    title: "Ankaufstationen",
    description: "Finden Sie eine Ankaufstation in Ihrer Nähe für die persönliche Übergabe",
    href: "/ankaufstationen",
  },
  {
    title: "Ratgeber",
    description: "Tipps zur optimalen Vorbereitung Ihres Wohnmobils für den Verkauf",
    href: "/ratgeber",
  },
  {
    title: "FAQ",
    description: "Antworten auf häufig gestellte Fragen zum Verkaufsprozess",
    href: "/faq",
  },
];

export const kaufenRelatedLinks: RelatedLink[] = [
  {
    title: "Ratgeber",
    description: "Worauf Sie beim Kauf eines gebrauchten Wohnmobils achten sollten",
    href: "/ratgeber",
  },
  {
    title: "FAQ",
    description: "Häufig gestellte Fragen zum Kaufprozess und zur Finanzierung",
    href: "/faq",
  },
  {
    title: "Über uns",
    description: "Erfahren Sie mehr über unsere Qualitätsstandards und unseren Service",
    href: "/ueber-uns",
  },
];

export const haendlerRelatedLinks: RelatedLink[] = [
  {
    title: "Händler werden",
    description: "Alle Infos zur Registrierung, Provision und dem Auktionsprozess",
    href: "/wohnmobil-haendler-werden",
  },
  {
    title: "Händler-Registrierung",
    description: "Jetzt kostenlos registrieren und sofort mitbieten",
    href: "/register/haendler",
  },
  {
    title: "Aktuelle Auktionen",
    description: "Entdecken Sie aktuelle Wohnmobil-Auktionen",
    href: "/kaufen",
  },
  {
    title: "Kontakt",
    description: "Vereinbaren Sie ein persönliches Beratungsgespräch",
    href: "/kontakt",
  },
  {
    title: "FAQ",
    description: "Häufig gestellte Fragen zum Händler-Partnerprogramm",
    href: "/faq",
  },
];

