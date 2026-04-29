/**
 * Kitchen Showcase Component
 * Zeigt Stil-Kategorien neuer Kuechen als Einstieg in die Funnels.
 * User waehlt einen Stil (Modern/Landhaus/Kochinsel/Design) und landet
 * in Funnel A mit vorgewaehltem Stil.
 */

import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, CheckCircle, Award, Users, ArrowRight } from "lucide-react";

// Unsplash-Stock-Photos fuer Kuechen-Stile bis eigene Assets in
// Supabase Storage liegen. Feste Photo-IDs → stabil & cachebar.
const KITCHEN_PHOTOS = {
  modern: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80",
  landhaus: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
  island: "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?auto=format&fit=crop&w=800&q=80",
  minimal: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=800&q=80",
};

const KitchenShowcase = () => {
  const showcaseItems = [
    {
      id: 1,
      image: KITCHEN_PHOTOS.modern,
      title: "Moderne Küchen",
      subtitle: "Grifflos, Hochglanz, Matt",
      badge: "Gefragt",
      styleSlug: "modern",
    },
    {
      id: 2,
      image: KITCHEN_PHOTOS.landhaus,
      title: "Landhaus & Klassisch",
      subtitle: "Zeitlos & gemütlich",
      badge: "Beliebt",
      styleSlug: "landhaus",
    },
    {
      id: 3,
      image: KITCHEN_PHOTOS.island,
      title: "Kochinsel-Küchen",
      subtitle: "Offener Wohn-Ess-Bereich",
      badge: "Trend",
      styleSlug: "kochinsel",
    },
    {
      id: 4,
      image: KITCHEN_PHOTOS.minimal,
      title: "Design- & Luxus-Küchen",
      subtitle: "Bulthaup, SieMatic, Poggenpohl",
      badge: "Premium",
      styleSlug: "minimalistisch",
    },
  ];

  const stats = [
    { icon: Users, value: "Bundesweit", label: "Geprüfte Küchenstudios" },
    { icon: CheckCircle, value: "48 h", label: "Ø Zeit bis zum Angebot" },
    { icon: Award, value: "100 %", label: "Kostenlos & unverbindlich" },
    { icon: Star, value: "Sicher", label: "DSGVO-konform" },
  ];

  return (
    <section className="py-12 lg:py-16 bg-gradient-to-b from-slate-50/30 via-slate-50/50 to-slate-50/30 overflow-hidden cv-auto">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8 mb-12">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-4 rounded-xl bg-card dark:bg-card shadow-sm border border-slate-100 dark:border-border"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-2xl lg:text-3xl font-bold text-foreground">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 px-4 py-1.5">
            <Star className="w-3.5 h-3.5 mr-1.5 fill-amber-400 text-amber-400" />
            Alle Stile & Marken
          </Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            Welcher Küchen-Stil passt zu Ihnen?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Ob Nobilia, Häcker, Nolte, SieMatic, Bulthaup oder kleiner Küchenbauer
            — unsere Partner-Studios beraten Sie zu allen Marken und Stilen.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {showcaseItems.map((item, index) => (
            <Link
              to={`/funnel/a/stil?vor=${item.styleSlug}`}
              key={item.id}
              className="block"
            >
              <Card
                className="group relative overflow-hidden rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 aspect-[4/3] cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0">
                  <img
                    src={item.image}
                    alt={item.title}
                    width={800}
                    height={600}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                <div className="absolute top-3 left-3 z-10">
                  <Badge className="bg-primary/90 hover:bg-primary text-white text-xs font-semibold shadow-lg">
                    {item.badge}
                  </Badge>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="font-bold text-base sm:text-lg group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/80">{item.subtitle}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10 space-y-3">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Noch unsicher?</span>{" "}
            Starten Sie mit der kostenlosen Anfrage — Stil legen Sie später fest.
          </p>
          <Link to="/funnel/a">
            <Button size="lg" className="gradient-hero hover:gradient-hero-hover mt-2">
              Kostenlos Angebote erhalten
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default KitchenShowcase;
