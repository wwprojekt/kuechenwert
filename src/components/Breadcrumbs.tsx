import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath, type BreadcrumbItem } from "@/lib/seo";

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb Navigation Component
 * Provides visual breadcrumbs and structured data for SEO
 */
const Breadcrumbs = ({ items, className = "" }: BreadcrumbsProps) => {
  // If no items provided, auto-generate from current path
  const breadcrumbItems = items || getBreadcrumbsFromPath(window.location.pathname);
  
  // Generate structured data
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  return (
    <>
      {/* Structured Data */}
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>

      {/* Visual Breadcrumbs */}
      <nav aria-label="Breadcrumb" className={`${className}`}>
        <ol className="flex items-center flex-wrap gap-2 text-sm text-muted-foreground">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;
            
            return (
              <li key={item.path} className="flex items-center gap-2">
                {index === 0 ? (
                  <Link
                    to={item.path}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Home className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.name}</span>
                  </Link>
                ) : isLast ? (
                  <span className="font-medium text-foreground">{item.name}</span>
                ) : (
                  <Link
                    to={item.path}
                    className="hover:text-primary transition-colors"
                  >
                    {item.name}
                  </Link>
                )}
                
                {!isLast && <ChevronRight className="h-4 w-4" />}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};

export default Breadcrumbs;

