import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { BLOG_CATEGORIES } from "@/data/blog-categories";

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

const ALL_CATEGORIES = "Alle Artikel";
const CATEGORIES = [ALL_CATEGORIES, ...BLOG_CATEGORIES];

const BlogEmptyState = () => (
  <div className="mx-auto max-w-2xl py-12 text-center">
    <h2 className="mb-3 text-2xl font-bold">Die ersten Artikel sind in Arbeit</h2>
    <p className="mb-8 text-muted-foreground">
      Bis dahin finden Sie Antworten in unseren häufigen Fragen, einen ersten Richtwert im KüchenRechner – oder
      Sie holen direkt kostenlose Angebote ein.
    </p>
    <div className="flex flex-col justify-center gap-3 sm:flex-row">
      <Button asChild variant="outline">
        <Link to="/faq">Häufige Fragen</Link>
      </Button>
      <Button asChild variant="outline">
        <Link to="/kuechenrechner">KüchenRechner</Link>
      </Button>
      <Button asChild>
        <Link to="/formular">Angebote holen</Link>
      </Button>
    </div>
  </div>
);

const BlogPage = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);

  const { data: posts, isLoading, isError, refetch } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data as BlogPost[];
    },
  });

  const hasPosts = (posts?.length ?? 0) > 0;
  const filteredPosts = posts?.filter((post) => {
    return selectedCategory === ALL_CATEGORIES || post.category === selectedCategory;
  }) || [];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Blog – Tipps rund um Ihre neue Küche"
      description="Artikel und Tipps rund um Planung, Budget, Materialien, Geräte und den Kauf einer neuen Küche."
      keywords="Küchen Blog, Küchen Planung, Küchen Budget, neue Küche kaufen Tipps, Küchenkauf Beratung"
      canonicalPath="/blog"
      noIndex={!hasPosts}
      structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/blog"))}
    >
      {/* Hero Section */}
      <PageHero size="md">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Tipps rund um Planung, Budget und Kauf Ihrer neuen Küche.
          </p>
        </div>
      </PageHero>

      {/* Categories */}
      {hasPosts && (
        <section className="py-8 border-b" aria-label="Kategorien">
          <div className="container">
            <div className="flex flex-wrap gap-4 justify-center">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={selectedCategory === category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-6 py-3 rounded-full border-2 transition-colors font-medium ${
                    selectedCategory === category
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Blog Posts Grid */}
      <section className="py-16">
        <div className="container">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground" role="status">Artikel werden geladen …</div>
          ) : isError ? (
            <div className="text-center py-12" role="alert">
              <p className="mb-4 text-muted-foreground">Die Artikel konnten nicht geladen werden.</p>
              <Button variant="outline" onClick={() => void refetch()}>
                Erneut versuchen
              </Button>
            </div>
          ) : !hasPosts ? (
            <BlogEmptyState />
          ) : filteredPosts.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">
              In dieser Kategorie gibt es noch keine Artikel.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <Card key={post.id} className="group overflow-hidden border-2 hover:border-primary transition-all hover-lift">
                  <Link to={`/blog/${post.slug}`}>
                    {post.featured_image_url && (
                      <div className="aspect-[16/10] overflow-hidden">
                        <img
                          src={post.featured_image_url}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Badge>{post.category}</Badge>
                        {post.published_at && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(post.published_at), 'dd.MM.yyyy', { locale: de })}</span>
                          </div>
                        )}
                      </div>
                      <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="text-muted-foreground mb-4 line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        Weiterlesen
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageLayout>
  );
};

export default BlogPage;
