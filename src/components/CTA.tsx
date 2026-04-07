import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, CheckCircle, Calculator } from "lucide-react";
import { Link } from "react-router-dom";

const CTA = () => {

  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-background relative overflow-hidden">
      {/* Value Calculator Promo Banner */}
      <div className="container px-4 sm:px-6 lg:px-8 mb-12">
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-2xl border-2 border-amber-200/50 p-6 sm:p-8 shadow-lg">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Calculator className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Was ist Ihr Wohnmobil wert?
              </h3>
              <p className="text-muted-foreground">
                Erhalten Sie in nur 4 Schritten eine kostenlose Sofort-Schätzung mit unserem Wertrechner.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/wertrechner">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg">
                  <Calculator className="h-4 w-4 mr-2" />
                  Sofort-Schätzung
                </Button>
              </Link>
              <Link to="/wertermittlung">
                <Button variant="outline" className="border-amber-300 hover:bg-amber-50">
                  Experten-Bewertung
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container relative px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-lg shadow-premium border-2 border-primary/30">
          {/* Gradient Background */}
          <div className="absolute inset-0 gradient-hero"></div>
          
          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Floating Elements */}
          <div className="absolute top-10 right-10 h-32 w-32 rounded-full bg-white/10 backdrop-blur-sm blur-2xl animate-float"></div>
          <div className="absolute bottom-10 left-10 h-40 w-40 rounded-full bg-white/10 backdrop-blur-sm blur-2xl animate-float" style={{ animationDelay: '2s' }}></div>

          <div className="relative z-10 px-5 sm:px-8 py-12 sm:py-16 md:p-20 lg:p-24">
            <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 lg:space-y-10">
              <div className="inline-flex items-center gap-2 glass-dark rounded-full px-4 sm:px-6 py-2 sm:py-3 animate-fade-in">
                <Sparkles className="h-4 sm:h-5 w-4 sm:w-5 text-white animate-pulse-glow" />
                <span className="text-xs sm:text-sm font-semibold text-white">
                  Bereit für den Verkauf?
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-tight tracking-tight animate-fade-in animate-delay-100">
                Verkaufen Sie Ihr Wohnmobil <br className="hidden md:block" />
                <span className="relative">
                  <span className="relative z-10">heute noch</span>
                  <div className="absolute inset-0 bg-white/20 blur-xl"></div>
                </span>
              </h2>

              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed animate-fade-in animate-delay-200 px-4">
                Starten Sie jetzt mit der kostenlosen Bewertung und erhalten Sie innerhalb von 24 Stunden attraktive Angebote von geprüften Händlern.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center pt-4 sm:pt-6 animate-fade-in animate-delay-300">
                <a href="/verkaufen/wizard" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="bg-white text-primary hover:bg-white/90 shadow-glow h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base hover-lift font-bold group w-full"
                  >
                    Kostenlose Bewertung starten
                    <ArrowRight className="ml-2 sm:ml-3 h-5 sm:h-6 w-5 sm:w-6 group-hover:translate-x-2 transition-smooth" />
                  </Button>
                </a>
                <a href="/verkaufen" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base hover-lift-sm border-2 border-white bg-white/10 text-white hover:bg-white/20 hover:text-white hover:border-white font-semibold backdrop-blur-sm w-full"
                  >
                    Mehr erfahren
                  </Button>
                </a>
              </div>

              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 pt-6 sm:pt-8 lg:pt-10 text-white animate-fade-in animate-delay-400">
                {[
                  "Kostenlos & unverbindlich",
                  "Kein Login zum Starten",
                  "Ergebnis in 24h"
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 sm:gap-3 glass-dark rounded-full px-4 sm:px-6 py-2 sm:py-3">
                    <CheckCircle className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
