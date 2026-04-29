import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * Explainer video embed for the homepage.
 *
 * Asset hosting:
 *   The MP4 should live in the KuechenWert Supabase `public-assets` bucket,
 *   NOT in the git repo. Shipping a >10 MB file inside the Docker image
 *   bloats the build context and stalls Dokploy deploys.
 *
 * TODO(rebrand): Kuechen-Erklaervideo produzieren + Asset in KüchenWert
 *   Supabase-Bucket hochladen und VIDEO_URL hier umbiegen. Bis dahin ist
 *   diese Komponente nicht in der Homepage eingebunden.
 *
 * Performance choices:
 *   - preload="none": zero bytes are fetched until the user actively clicks
 *     the play overlay. No metadata HEAD, no moov-atom fetch. Removes any
 *     LCP / TTFB impact for the 90% of visitors who never click play.
 *   - Native controls after first play: we don't duplicate what the browser
 *     already renders beautifully (play/pause, scrubber, volume, fullscreen).
 */

const EXPLAINER_VIDEO_URL =
  "https://gzqayoalwtmypndrmqes.supabase.co/storage/v1/object/public/public-assets/erklaervideo.mp4";
const ExplainerVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handlePlayClick = () => {
    const video = videoRef.current;
    if (!video) return;
    // play() may reject (network error, unsupported codec, user-gesture lost).
    // We only flip hasStarted inside the native onPlay handler, so a failed
    // play leaves the big overlay button visible and the user can retry.
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => {
        console.error("[ExplainerVideo] play() rejected", err);
        setHasError(true);
      });
    }
  };

  return (
    <section
      id="erklaervideo"
      className="py-12 sm:py-16 md:py-20 lg:py-24 bg-muted/30 cv-auto"
    >
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 lg:mb-12 space-y-3 sm:space-y-4">
          <div className="inline-block animate-fade-in">
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-semibold text-primary">
              In 90 Sekunden erklärt
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight animate-fade-in animate-delay-100">
            So funktioniert {BRAND.name}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed animate-fade-in animate-delay-200">
            Sehen Sie in unserem kurzen Erklärvideo, wie Sie kostenlose
            Angebote für Ihre Traumküche vergleichen und den besten Preis
            finden.
          </p>
        </div>

        <div className="max-w-4xl mx-auto animate-fade-in animate-delay-300">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border bg-black aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              preload="none"
              controls={hasStarted}
              onPlay={() => {
                setHasStarted(true);
                setHasError(false);
              }}
              onError={() => setHasError(true)}
              aria-label={`Erklärvideo: So funktioniert ${BRAND.name}`}
            >
              <source src={EXPLAINER_VIDEO_URL} type="video/mp4" />
              Ihr Browser unterstützt leider keine eingebetteten Videos.
            </video>

            {!hasStarted && !hasError && (
              <button
                type="button"
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-smooth group cursor-pointer"
                aria-label="Erklärvideo abspielen"
              >
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-primary transition-smooth">
                  <Play
                    className="h-8 w-8 sm:h-10 sm:w-10 text-white fill-white ml-1"
                    aria-hidden="true"
                  />
                </div>
              </button>
            )}

            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
                <div className="space-y-3 max-w-sm">
                  <p className="text-white font-semibold text-base sm:text-lg">
                    Video konnte nicht geladen werden
                  </p>
                  <p className="text-white/80 text-sm">
                    Bitte prüfen Sie Ihre Internetverbindung und laden Sie die
                    Seite neu.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setHasError(false);
                      handlePlayClick();
                    }}
                    className="inline-flex items-center rounded-full bg-primary hover:bg-primary/90 px-5 py-2 text-sm font-semibold text-white transition-smooth"
                  >
                    Erneut versuchen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExplainerVideo;
