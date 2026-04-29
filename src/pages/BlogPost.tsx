import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageHero from "@/components/PageHero";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  category: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
}

const BlogPost = () => {
  const { slug } = useParams();
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 py-20">
          <div className="container text-center">Lädt...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 py-20">
          <div className="container text-center">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">Blogpost nicht gefunden</h1>
            <Link to="/blog">
              <Button>Zurück zum Blog</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Generate structured data for the article
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || post.title,
    datePublished: post.published_at || post.created_at,
    dateModified: post.created_at,
    author: {
      '@type': 'Organization',
      name: siteName,
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${BRAND.baseUrl}/logo.svg`,
      },
    },
    image:
      post.featured_image_url ||
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&h=630&q=80",
    articleSection: post.category,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BRAND.baseUrl}/blog/${post.slug}`,
    },
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title={post.title}
      description={post.excerpt || post.title}
      canonicalPath={`/blog/${post.slug}`}
      ogImage={post.featured_image_url || undefined}
      structuredData={articleSchema}
    >
      {/* Hero Section */}
      <PageHero size="sm">
        <div className="max-w-4xl mx-auto">
          <Link to="/blog" className="inline-flex items-center gap-2 text-primary hover:underline mb-6">
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Blog
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <Badge>{post.category}</Badge>
            {post.published_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(post.published_at), 'dd. MMMM yyyy', { locale: de })}</span>
              </div>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-xl text-muted-foreground">
              {post.excerpt}
            </p>
          )}
        </div>
      </PageHero>

      {/* Featured Image */}
      {post.featured_image_url && (
        <section className="py-8">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="w-full h-auto rounded-xl shadow-lg"
              />
            </div>
          </div>
        </section>
      )}

      {/* Content */}
      <section className="py-12">
        <div className="container">
          <div 
            className="max-w-4xl mx-auto prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: DOMPurify.sanitize(post.content, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
                ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel']
              })
            }}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">
              Möchten Sie Ihre Küche verkaufen?
            </h2>
            <p className="text-primary-foreground/90 mb-8">
              Starten Sie jetzt mit der kostenlosen Bewertung und erhalten Sie attraktive Angebote.
            </p>
            <Link to="/funnel/a">
              <Button size="lg" variant="secondary">
                Jetzt Küchen-Bewertung starten
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default BlogPost;
