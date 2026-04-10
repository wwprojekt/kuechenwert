import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Shield, Star, TrendingUp, Calculator } from "lucide-react";
import { QuickAuctionForm } from "./QuickAuctionForm";

const Hero = () => {
  const benefits = [
    { icon: Clock, text: "In unter 48 Stunden verkauft" },
    { icon: Shield, text: "100% sicher & seriös" },
    { icon: TrendingUp, text: "Faire Marktpreise" },
  ];

  return (
    <section className="relative min-h-fit lg:min-h-[85vh] overflow-hidden">
      {/* Background Image - Full width - Emotionales Wohnmobil-Lifestyle-Bild */}
      <div 
        className="absolute inset-0 bg-cover bg-center lg:bg-right"
        style={{
          backgroundImage: `url('/images/hero-motorhome.webp')`,
        }}
      />
      
      {/* Overlay gradient - left side solid for text, fades to show image on right */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, 
            rgba(255,255,255,0.92) 0%, 
            rgba(255,255,255,0.85) 25%, 
            rgba(255,255,255,0.60) 40%, 
            rgba(255,255,255,0.3) 55%, 
            rgba(255,255,255,0.05) 70%
          )`,
        }}
      />
      
      {/* Mobile: additional overlay for better readability */}
      <div className="absolute inset-0 bg-white/70 dark:bg-black/70 lg:hidden" />

      {/* Main Content */}
      <div className="container relative px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-fit lg:min-h-[75vh]">
          
          {/* Left Column - Hero Text & Benefits (hidden on mobile, wizard shown first) */}
          <div className="hidden lg:block space-y-6 lg:space-y-8 z-10">
            {/* Badge */}
            <div className="inline-block animate-fade-in">
              <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary shadow-sm">
                <Star className="w-4 h-4 mr-2 fill-primary" />
                Wohnmobil-Verkauf leicht gemacht
              </span>
            </div>
            
            {/* Main Headline */}
            <div className="space-y-4 animate-fade-in animate-delay-100">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
                Wohnmobil verkaufen.
              </h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-primary">
                Schnell. Einfach. Online.
              </h2>
            </div>

            {/* Subheadline - Enticing promise */}
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed animate-fade-in animate-delay-200 max-w-xl">
              Verkaufen Sie Ihr Wohnmobil <span className="font-semibold text-foreground">in weniger als 48 Stunden</span> – bundesweit, kostenlos und an verifizierte Händler.
            </p>

            {/* Benefits List with Checkmarks */}
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

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-in animate-delay-400">
              <a href="/verkaufen/wizard" className="w-full sm:w-auto">
                <Button size="lg" className="gradient-hero hover:shadow-glow h-14 px-8 text-base font-semibold group w-full">
                  Jetzt kostenlos verkaufen
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-smooth" />
                </Button>
              </a>
              <a href="/wertrechner" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="h-14 px-8 text-base font-semibold w-full border-2 group hover:border-primary">
                  <Calculator className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                  Wert berechnen
                </Button>
              </a>
            </div>
          </div>

          {/* Right Column - Form (shown first on mobile via flex-col-reverse) */}
          <div className="relative lg:animate-slide-in-right z-10 lg:pl-8">
            <QuickAuctionForm variant="hero" />
          </div>
        </div>
      </div>

      {/* Bottom Visual Elements - Motorhome Silhouettes */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 left-1/4 w-48 h-24 bg-gradient-to-t from-primary/5 to-transparent rounded-t-3xl transform -skew-x-6" />
        <div className="absolute bottom-0 right-1/4 w-64 h-20 bg-gradient-to-t from-primary/3 to-transparent rounded-t-2xl transform skew-x-3" />
      </div>
    </section>
  );
};

export default Hero;
