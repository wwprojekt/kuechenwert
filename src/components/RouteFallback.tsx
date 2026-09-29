import { useEffect } from "react";
import { peekInitialRouteHtml, releaseInitialRouteHtml } from "@/lib/initialRouteHtml";

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

/**
 * Suspense-Platzhalter der Routen: beim ersten Laden einer vorgerenderten Seite
 * deren eigenes HTML (siehe lib/initialRouteHtml), sonst ein Spinner.
 */
export default function RouteFallback() {
  const html = peekInitialRouteHtml();
  useEffect(() => releaseInitialRouteHtml, []);
  if (html) return <div className="contents" dangerouslySetInnerHTML={{ __html: html }} />;
  return <PageLoader />;
}
