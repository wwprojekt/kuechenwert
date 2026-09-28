import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { logger } from "@/lib/logger";
import PageLayout from "@/components/PageLayout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageLayout
      title="Seite nicht gefunden (404)"
      description="Die angeforderte Seite konnte nicht gefunden werden."
      noIndex={true}
    >
      {/* Additional 404-specific meta */}
      <Helmet>
        <meta name="prerender-status-code" content="404" />
      </Helmet>
      
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-[60vh]">
        {/* Consistent gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.08] via-background to-background" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/[0.06] to-transparent" />
        
        <div className="text-center relative z-10">
          <h1 className="mb-4 text-8xl font-bold text-primary">404</h1>
          <p className="mb-6 text-xl text-muted-foreground">
            Diese Seite wurde nicht gefunden
          </p>
          <Button asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Zurück zur Startseite
            </Link>
          </Button>
          <nav aria-label="Beliebte Seiten" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link to="/formular" className="font-medium text-primary underline-offset-4 hover:underline">
              Angebote holen
            </Link>
            <Link to="/funnel/c" className="font-medium text-primary underline-offset-4 hover:underline">
              Küche planen
            </Link>
            <Link to="/faq" className="font-medium text-primary underline-offset-4 hover:underline">
              Häufige Fragen
            </Link>
            <Link to="/kontakt" className="font-medium text-primary underline-offset-4 hover:underline">
              Kontakt
            </Link>
          </nav>
        </div>
      </div>
    </PageLayout>
  );
};

export default NotFound;
