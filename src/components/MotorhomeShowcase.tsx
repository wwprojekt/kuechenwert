/**
 * Motorhome Showcase Component
 * Displays high-quality motorhome images with trust indicators
 */

import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, CheckCircle, Award, Users, ArrowRight } from "lucide-react";

const MotorhomeShowcase = () => {
  const showcaseItems = [
    {
      id: 1,
      image: "/images/motorhome-integrated.jpg",
      title: "Integrierte Wohnmobile",
      subtitle: "Faire Preise",
      badge: "Beliebt",
    },
    {
      id: 2,
      image: "/images/motorhome-alcove.jpg",
      title: "Alkoven-Wohnmobile",
      subtitle: "Schneller Verkauf",
      badge: "Top",
    },
    {
      id: 3,
      image: "/images/motorhome-van.jpg",
      title: "Campervans & Kastenwagen",
      subtitle: "Hohe Nachfrage",
      badge: "Gefragt",
    },
    {
      id: 4,
      image: "/images/caravan-touring.jpg",
      title: "Wohnwagen & Caravans",
      subtitle: "Sofort verkaufen",
      badge: "Neu",
    },
  ];

  const stats = [
    { icon: Users, value: "Bundesweit", label: "Verifizierte Händler" },
    { icon: CheckCircle, value: "48h", label: "Durchschnittl. Verkaufszeit" },
    { icon: Award, value: "100%", label: "Kostenlos & unverbindlich" },
    { icon: Star, value: "Sicher", label: "Geprüfter Service" },
  ];

  return (
    <section className="py-12 lg:py-16 bg-gradient-to-b from-slate-50/30 via-slate-50/50 to-slate-50/30 overflow-hidden">
      <div className="container px-4 sm:px-6 lg:px-8">
        {/* Stats Bar */}
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

        {/* Section Header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 px-4 py-1.5">
            <Star className="w-3.5 h-3.5 mr-1.5 fill-amber-400 text-amber-400" />
            Erfolgreich verkauft
          </Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            Wohnmobile aller Marken & Typen
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Ob Teilintegriert, Alkoven, Kastenwagen oder Luxusliner – wir finden den passenden Käufer für Ihr Fahrzeug.
          </p>
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {showcaseItems.map((item, index) => (
            <Link
              to="/verkaufen/wizard"
              key={item.id}
              className="block"
            >
              <Card
                className="group relative overflow-hidden rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 aspect-[4/3] cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Real Image */}
                <div className="absolute inset-0">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>

                {/* Badge */}
                <div className="absolute top-3 left-3 z-10">
                  <Badge className="bg-primary/90 hover:bg-primary text-white text-xs font-semibold shadow-lg">
                    {item.badge}
                  </Badge>
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/80">{item.subtitle}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-10 space-y-3">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Verkaufen auch Sie Ihr Wohnmobil</span> – unkompliziert und fair!
          </p>
          <Link to="/verkaufen">
            <Button size="lg" className="gradient-hero hover:gradient-hero-hover mt-2">
              Jetzt kostenlos bewerten lassen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default MotorhomeShowcase;
