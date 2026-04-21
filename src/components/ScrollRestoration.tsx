import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollRestoration = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    // When a hash is present (e.g. /wertrechner#reviews) we want to scroll to
    // the matching anchor instead of jumping to the top of the page. We retry
    // briefly because the target element may not be mounted yet on the first
    // tick after navigation (lazy components, suspense fallbacks, etc.).
    if (hash) {
      const id = hash.startsWith("#") ? hash.slice(1) : hash;
      let attempts = 0;
      const maxAttempts = 20; // ~1s total at 50ms intervals
      const tryScroll = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(tryScroll, 50);
        } else {
          // Anchor never appeared — fall back to top so user is not stuck mid-page.
          window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        }
      };
      tryScroll();
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  return null;
};

export default ScrollRestoration;
