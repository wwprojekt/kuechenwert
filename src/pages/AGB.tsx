import { useQuery } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

const AGB = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;
  const { data: legalPage, isLoading, error } = useQuery({
    queryKey: ["legalPage", "agb"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_pages")
        .select("*")
        .eq("slug", "agb")
        .eq("is_published", true)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fallback content if database fetch fails
  const fallbackContent = `
    <h2>§ 1 Geltungsbereich</h2>
    <p>Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen der ${BRAND.legalName} (nachfolgend „Anbieter") — Betreiberin der Marke ${siteName} — und ihren Kunden über die Nutzung der Online-Plattform zum Kauf und Verkauf von Küchen sowie zur Vermittlung von Küchen-Planungsleistungen.</p>
    <h2>§ 2 Vertragsschluss</h2>
    <p>Die Darstellung der Küchen auf unserer Website stellt kein rechtlich bindendes Angebot dar, sondern eine Aufforderung zur Abgabe eines Angebots.</p>
  `;

  return (
    <PageLayout
      breadcrumbs={true}
      title={`AGB - ${siteName}`}
      description={`Allgemeine Geschäftsbedingungen von ${siteName}`}
      canonicalPath="/agb"
      noIndex={true}
    >
      <PageHero size="sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold">
            {legalPage?.title || "Allgemeine Geschäftsbedingungen (AGB)"}
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

export default AGB;
