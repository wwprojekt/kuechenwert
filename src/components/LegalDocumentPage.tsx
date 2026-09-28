import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import PageHero from "@/components/PageHero";
import PageLayout from "@/components/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand/config";

interface LegalDocumentPageProps {
  slug: string;
  fallbackTitle: string;
  description: string;
}

/**
 * Rechtstext aus legal_pages (im Admin unter „Rechtliches“ gepflegt). Schlägt
 * das Laden fehl, zeigen wir bewusst keinen hinterlegten Ersatztext, damit nie
 * veraltete Klauseln erscheinen.
 */
export function LegalDocumentPage({ slug, fallbackTitle, description }: LegalDocumentPageProps) {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;
  const contactEmail = settings?.contact_email || BRAND.supportEmail;
  const { data: page, isLoading, isError } = useQuery({
    queryKey: ["legalPage", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_pages")
        .select("title, content, updated_at")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <PageLayout breadcrumbs title={`${page?.title || fallbackTitle} - ${siteName}`} description={description} canonicalPath={`/${slug}`} noIndex>
      <PageHero size="sm">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold md:text-5xl">{page?.title || fallbackTitle}</h1>
        </div>
      </PageHero>

      <div className="container max-w-4xl py-12">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : isError || !page ? (
          <p className="text-muted-foreground" role="alert">
            Der Text konnte gerade nicht geladen werden. Bitte laden Sie die Seite neu oder schreiben Sie an{" "}
            <a className="text-primary underline" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            .
          </p>
        ) : (
          <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }} />
        )}
      </div>
    </PageLayout>
  );
}
