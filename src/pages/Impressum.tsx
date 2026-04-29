import { useQuery } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

const Impressum = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;
  const { data: legalPage, isLoading, error } = useQuery({
    queryKey: ["legalPage", "impressum"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_pages")
        .select("*")
        .eq("slug", "impressum")
        .eq("is_published", true)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const supportPhone = settings?.support_phone || '';
  const contactEmail = settings?.contact_email || BRAND.supportEmail;
  const companyAddress = settings?.company_address || '';
  const companyCity = settings?.company_city || '';
  const companyPostalCode = settings?.company_postal_code || '';
  const companyCountry = settings?.company_country || 'Deutschland';

  // Fallback content if database fetch fails. Die Marke ${siteName} wird von
  // der ${BRAND.legalName} betrieben — daher nutzen wir den legalName hier,
  // nicht den Markennamen.
  const fallbackContent = `
    <h2>Angaben gemäß § 5 TMG</h2>
    <p>${BRAND.legalName}${companyAddress ? `<br>${companyAddress}` : ''}${companyPostalCode || companyCity ? `<br>${companyPostalCode} ${companyCity}` : ''}${companyCountry ? `<br>${companyCountry}` : ''}</p>
    <p>${siteName} ist eine Marke der ${BRAND.legalName}.</p>
    <h2>Kontakt</h2>
    <p>${supportPhone ? `Telefon: ${supportPhone}<br>` : ''}E-Mail: ${contactEmail}</p>
  `;

  return (
    <PageLayout
      breadcrumbs={true}
      title={`Impressum - ${siteName}`}
      description={`Impressum und Anbieterkennzeichnung von ${siteName}`}
      canonicalPath="/impressum"
      noIndex={true}
    >
      <PageHero size="sm">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold">
            {legalPage?.title || "Impressum"}
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
          <div className="prose prose-lg max-w-none">
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  legalPage?.content || (error ? fallbackContent : "")
                ),
              }}
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Impressum;
