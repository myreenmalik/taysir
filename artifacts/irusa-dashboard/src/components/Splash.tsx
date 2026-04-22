import { useEffect, useState } from "react";

const STORAGE_KEY = "taysir-splash-shown";

export function Splash() {
  const [phase, setPhase] = useState<"hidden" | "drawing" | "fading">(() => {
    if (typeof window === "undefined") return "hidden";
    return sessionStorage.getItem(STORAGE_KEY) ? "hidden" : "drawing";
  });

  useEffect(() => {
    if (phase === "hidden") return;
    const fadeTimer = window.setTimeout(() => setPhase("fading"), 4800);
    const doneTimer = window.setTimeout(() => {
      setPhase("hidden");
      sessionStorage.setItem(STORAGE_KEY, "1");
    }, 6000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-[1200ms] ${
        phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      data-testid="splash-screen"
    >
      {/* Powder blue blob behind */}
      <div
        aria-hidden="true"
        className="absolute top-[-20%] right-[-10%] h-[80vh] w-[80vh] rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsla(210, 70%, 75%, 0.55) 0%, hsla(210, 70%, 80%, 0.0) 70%)",
        }}
      />

      <div className="relative flex flex-col items-center text-center px-6">
        {/* Eyebrow */}
        <div className="splash-eyebrow text-[11px] uppercase tracking-[0.32em] text-muted-foreground font-medium mb-6">
          Islamic Relief USA
        </div>

        {/* Arabic calligraphy — drawn on with a wipe-reveal mask */}
        <div className="splash-arabic-wrap relative mx-auto">
          <span
            lang="ar"
            dir="rtl"
            className="splash-arabic font-arabic block text-foreground/85 leading-none text-center"
          >
            تيسير
          </span>
        </div>

        {/* Wordmark fade-in */}
        <div className="splash-wordmark mt-6 flex items-baseline gap-1">
          <span className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground">
            Taysir
          </span>
          <span className="text-5xl sm:text-6xl font-bold text-primary">.</span>
        </div>

        {/* Tagline */}
        <div className="splash-tagline mt-4 text-sm uppercase tracking-[0.28em] text-muted-foreground">
          Ease, by design
        </div>
      </div>

      <style>{`
        .splash-arabic-wrap {
          overflow: hidden;
          padding: 0.15em 0.2em;
          display: inline-block;
        }
        .splash-arabic {
          font-size: clamp(6rem, 18vw, 14rem);
          letter-spacing: -0.02em;
          color: hsl(var(--foreground) / 0.9);
          clip-path: inset(0 0 0 100%);
          animation: splashDraw 2400ms cubic-bezier(0.65, 0, 0.35, 1) 300ms forwards;
          /* Visual-center nudge — Arabic glyphs render with uneven side bearings */
          padding-right: 0.08em;
        }
        @keyframes splashDraw {
          0%   { clip-path: inset(0 0 0 100%); }
          100% { clip-path: inset(0 0 0 0%); }
        }
        .splash-eyebrow {
          opacity: 0;
          animation: splashFade 700ms ease-out 100ms forwards;
        }
        .splash-wordmark, .splash-tagline {
          opacity: 0;
          transform: translateY(8px);
          animation: splashRise 800ms ease-out forwards;
        }
        .splash-wordmark { animation-delay: 2400ms; }
        .splash-tagline  { animation-delay: 2900ms; }
        @keyframes splashFade {
          to { opacity: 1; }
        }
        @keyframes splashRise {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
