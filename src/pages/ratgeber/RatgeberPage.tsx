import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import RatgeberTemplate from "./RatgeberTemplate";
import {
  loadRatgeberConfig,
  ratgeberMeta,
  type RatgeberConfig,
} from "@/data/ratgeber/ratgeber-index";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; config: RatgeberConfig }
  | { status: "not-found" };

const RatgeberPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>(() => {
    // Synchronous fast-path: an unknown slug never needs a chunk fetch and
    // can redirect immediately, matching the old eager-import behaviour.
    if (!slug || !ratgeberMeta.some((m) => m.slug === slug)) {
      return { status: "not-found" };
    }
    return { status: "loading" };
  });

  useEffect(() => {
    if (!slug) return;
    if (!ratgeberMeta.some((m) => m.slug === slug)) {
      setState({ status: "not-found" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    loadRatgeberConfig(slug)
      .then((config) => {
        if (cancelled) return;
        setState(
          config ? { status: "ready", config } : { status: "not-found" },
        );
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "not-found" });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === "not-found") {
    return <Navigate to="/ratgeber" replace />;
  }

  if (state.status === "loading") {
    // Same look-and-feel as the global Suspense fallback in App.tsx so
    // the route transition stays visually consistent.
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <RatgeberTemplate config={state.config} />;
};

export default RatgeberPage;
