import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Shield, Star, TrendingUp, Calculator } from "lucide-react";
import { Link } from "react-router-dom";
import { ReviewStarsBadge } from "@/components/wertrechner/ReviewStarsBadge";

// Temporaerer Stock-Hero bis eigene Kuechen-Assets in /public/images/ liegen.
// Unsplash-URL direkt (nicht ueber Supabase Storage, damit kein Cache-Layer
// involviert ist). Eigene Bilder ersetzen spaeter dieses src.
const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1920&q=80";

const Hero = () => {
  const benefits = [
    { icon: Clock, text: "Ergebnis in unter 48 Stunden" },
    { icon: Shield, text: "100% kostenlos & unverbindlich" },
    { icon: TrendingUp, text: "Faire Bewertung durch Profis" },
  ];

  return (
    <section className="relative min-h-fit lg:min-h-[85vh] overflow-hidden">
      <img
        src={HERO_IMAGE_URL}
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover lg:object-right"
      />

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, 
            rgba(255,255,255,0.94) 0%, 
            rgba(255,255,255,0.88) 25%, 
            rgba(255,255,255,0.60) 45%, 
            rgba(255,255,255,0.25) 65%, 
            rgba(255,255,255,0.05) 80%
          )`,
        }}
      />

      <div className="absolute inset-0 bg-white/70 dark:bg-black/70 lg:hidden" />

      <div className="container relative px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-20">
        <div className="flex gap-3 mb-6 lg:hidden z-10 relative animate-fade-in">
          <Link to="/funnel/a" className="flex-1">
            <Button size="lg" className="gradient-hero h-12 text-sm font-semibold group w-full">
              Jetzt verkaufen
              <ArrowRight className="ml-1.5 h-4 w-4 group-hover:translate-x-1 transition-smooth" />
            </Button>
          </Link>
          <Link to="/wertrechner" className="flex-1">
            <Button size="lg" className="h-12 text-sm font-semibold w-full bg-amber-500 hover:bg-amber-600 text-white shadow-md">
              <Calculator className="mr-1.5 h-4 w-4" />
              Wertrechner
            </Button>
          </Link>
        </div>

        <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-fit lg:min-h-[70vh]">

          {/* Left Column - Hero Text & Benefits */}
          <div className="space-y-6 lg:space-y-8 z-10">
            <div className="inline-block animate-fade-in">
              <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary shadow-sm">
                <Star className="w-4 h-4 mr-2 fill-primary" />
                Deutschlands Küchen-Marktplatz
              </span>
            </div>

            <div className="space-y-4 animate-fade-in animate-delay-100">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                Küche verkaufen.
              </h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-primary">
                Schnell. Einfach. Fair bewertet.
              </h2>
            </div>

            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed animate-fade-in animate-delay-200 max-w-xl">
              Holen Sie sich <span className="font-semibold text-foreground">in 2 Minuten eine kostenlose Bewertung</span> Ihrer gebrauchten Küche — und bekommen Sie konkrete Angebote von geprüften Küchen-Händlern.
            </p>

            <div className="space-y-3 animate-fade-in animate-delay-300">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <benefit.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-base sm:text-lg font-medium text-foreground">
                    {benefit.text}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA Buttons - jetzt auf Küchen-Funnel /funnel/a statt alter Wizard */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-in animate-delay-400">
              <Link to="/funnel/a" className="w-full sm:w-auto">
                <Button size="lg" className="gradient-hero hover:shadow-glow h-14 px-8 text-base font-semibold group w-full">
                  Kostenlos bewerten lassen
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-smooth" />
                </Button>
              </Link>
              <Link to="/wertrechner" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="h-14 px-8 text-base font-semibold w-full border-2 group hover:border-primary">
                  <Calculator className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                  Wertrechner
                </Button>
              </Link>
            </div>

            <div className="animate-fade-in animate-delay-500">
              <ReviewStarsBadge size="sm" variant="full" link linkTo="/wertrechner#reviews" />
            </div>
          </div>

          {/* Right Column - Trust-Card (ersetzt QuickAuctionForm bis Küchen-Variante existiert) */}
          <div className="relative lg:animate-slide-in-right z-10 lg:pl-8">
            <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border border-primary/10 p-6 sm:p-8 max-w-md mx-auto lg:ml-auto">
              <div className="text-center mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">In 3 Schritten zum Verkauf</p>
                <h3 className="text-2xl font-extrabold text-foreground">Ihre Küche ist mehr wert als Sie denken</h3>
              </div>
              <ol className="space-y-4 mb-6">
                {[
                  { n: 1, t: "Angaben zur Küche", d: "Marke, Alter, Ausstattung — 17 Fragen, 2 Minuten" },
                  { n: 2, t: "Kostenlose Bewertung", d: "Unsere Experten prüfen Marktwert & Zustand" },
                  { n: 3, t: "Angebote vergleichen", d: "Geprüfte Küchen-Händler bieten — Sie wählen" },
                ].map((s) => (
                  <li key={s.n} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center text-sm">
                      {s.n}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{s.t}</p>
                      <p className="text-sm text-muted-foreground">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/funnel/a" className="block">
                <Button size="lg" className="gradient-hero w-full h-12 text-base font-semibold group">
                  Jetzt starten
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-smooth" />
                </Button>
              </Link>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Kostenlos · Unverbindlich · DSGVO-konform
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 left-1/4 w-48 h-24 bg-gradient-to-t from-primary/5 to-transparent rounded-t-3xl transform -skew-x-6" />
        <div className="absolute bottom-0 right-1/4 w-64 h-20 bg-gradient-to-t from-primary/3 to-transparent rounded-t-2xl transform skew-x-3" />
      </div>
    </section>
  );
};

export default Hero;
