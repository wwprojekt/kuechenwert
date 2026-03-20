import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousPathRef = useRef(location.pathname);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (location.pathname === previousPathRef.current) {
      return;
    }

    previousPathRef.current = location.pathname;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setIsTransitioning(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      setIsTransitioning(false);
    }, 150);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname]);

  return (
    <>
      {isTransitioning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full gradient-hero flex items-center justify-center shadow-glow">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
            <p className="text-muted-foreground font-medium">Wird geladen...</p>
          </div>
        </div>
      )}

      {/* During transition: collapse to 0 height so browser cannot see/anchor
          to footer or any other element. When transition ends, scroll is
          already at 0 and content expands fresh. */}
      <div style={isTransitioning ? { height: 0, overflow: "hidden" } : undefined}>
        {children}
      </div>
    </>
  );
};

export default PageTransition;
