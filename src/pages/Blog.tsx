import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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

const BlogPage = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("Alle Artikel");

  const { data: posts, isLoading } = useQuery({
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

  const categories = ["Alle Artikel", "Allgemein", "Kaufberatung", "Verkaufstipps", "Wartung & Pflege", "Reiseberichte", "Rechtliches"];

  const filteredPosts = posts?.filter((post) => {
    return selectedCategory === "Alle Artikel" || post.category === selectedCategory;
  }) || [];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Blog – Ratgeber & News rund um gebrauchte Küchen"
      description="Aktuelle Artikel, Tipps und Ratgeber rund um den Kauf und Verkauf gebrauchter Küchen. Markttrends, Bewertungstipps, Demontage & mehr."
      keywords="Küchen Blog, Küchen Ratgeber, Küchen Tipps, Küche kaufen Beratung, Küche verkaufen Tipps"
      canonicalPath="/blog"
      structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/blog"))}
    >
      {/* Hero Section */}
      <PageHero size="md">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Blog & Ratgeber
          </h1>
          <p className="text-lg text-muted-foreground">
            Expertenwissen, aktuelle Markttrends und hilfreiche Tipps rund um gebrauchte Küchen – regelmäßig aktualisiert.
          </p>
        </div>
      </PageHero>

      {/* Categories */}
      <section className="py-8 border-b">
        <div className="container">
          <div className="flex flex-wrap gap-4 justify-center">
            {categories.map((category) => (
              <button
                key={category}
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

      {/* Blog Posts Grid */}
      <section className="py-16">
        <div className="container">
          {isLoading ? (
            <div className="text-center py-12">Lädt...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-4">Noch keine Blogposts vorhanden.</p>
              <p className="text-sm">Schauen Sie bald wieder vorbei!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <Card key={post.id} className="group overflow-hidden border-2 hover:border-primary transition-all hover-lift">
                  <Link to={`/blog/${post.slug}`}>
                    {post.featured_image_url && (
                      <div className="aspect-[16/10] overflow-hidden">
                        <img
                          src={post.featured_image_url}
                          alt={post.title}
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
                      <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                        {post.title}
                      </h3>
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
