import { useQuery } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

const Datenschutz = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;
  const { data: legalPage, isLoading, error } = useQuery({
    queryKey: ["legalPage", "datenschutz"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_pages")
        .select("*")
        .eq("slug", "datenschutz")
        .eq("is_published", true)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fallback content if database fetch fails
  const fallbackContent = `
    <h2>1. Datenschutz auf einen Blick</h2>
    <h3>Allgemeine Hinweise</h3>
    <p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.</p>
    <h2>2. Datenerfassung auf dieser Website</h2>
    <p>Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.</p>
  `;

  return (
    <PageLayout
      breadcrumbs={true}
      title={`Datenschutzerklärung - ${siteName}`}
      description={`Datenschutzerklärung von ${siteName}`}
      canonicalPath="/datenschutz"
      noIndex={true}
    >
      <PageHero size="sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold">
            {legalPage?.title || "Datenschutzerklärung"}
          </h1>
        </div>
      </PageHero>
      
      <div className="container py-12 max-w-4xl">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-8 w-2/3 mt-8" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="prose prose-lg max-w-none space-y-8">
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  legalPage?.content || (error ? fallbackContent : "")
                ),
              }}
            />
            <p className="text-sm text-muted-foreground mt-8">
              Stand: {legalPage?.updated_at 
                ? new Date(legalPage.updated_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
                : new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })}
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Datenschutz;
