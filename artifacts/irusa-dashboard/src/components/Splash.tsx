import { useEffect, useState } from "react";

const STORAGE_KEY = "taysir-splash-shown";

export function Splash() {
  const [phase, setPhase] = useState<"hidden" | "drawing" | "fading">(() => {
    if (typeof window === "undefined") return "hidden";
    return sessionStorage.getItem(STORAGE_KEY) ? "hidden" : "drawing";
  });

  useEffect(() => {
    if (phase === "hidden") return;
    const fadeTimer = window.setTimeout(() => setPhase("fading"), 5200);
    const doneTimer = window.setTimeout(() => {
      setPhase("hidden");
      sessionStorage.setItem(STORAGE_KEY, "1");
    }, 6500);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden bg-background transition-opacity duration-[1300ms] ${
        phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      data-testid="splash-screen"
    >
      {/* Powder blue diffused blob, upper-right */}
      <div
        aria-hidden="true"
        className="absolute top-[-15%] right-[-15%] h-[90vh] w-[90vh] rounded-full opacity-80 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsla(210, 75%, 70%, 0.55) 0%, hsla(210, 75%, 80%, 0.0) 70%)",
        }}
      />

      {/* Top bar: ISLAMIC RELIEF USA (left) + presented by (right) */}
      <div className="splash-topbar absolute top-8 left-8 right-8 flex items-start justify-between text-xs tracking-wide">
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">Islamic Relief USA</span>
          <span className="mt-2 block h-px w-48 bg-foreground/40" />
        </div>
        <div className="text-right text-muted-foreground leading-relaxed">
          <div className="font-medium text-foreground/80">Presented by:</div>
          <div>Myreen Malik &amp; Bareera Saif</div>
        </div>
      </div>

      {/* Center composition */}
      <div className="absolute inset-0 flex items-center">
        <div className="relative w-full max-w-6xl mx-auto px-12">
          {/* Huge Arabic watermark, behind the wordmark, slightly right */}
          <span
            lang="ar"
            dir="rtl"
            aria-hidden="true"
            className="splash-arabic font-arabic absolute left-1/2 top-1/2 -translate-y-1/2 text-foreground/[0.10] leading-none whitespace-nowrap pointer-events-none select-none"
          >
            تيسير
          </span>

          {/* Wordmark — big, bold, left-aligned */}
          <div className="splash-wordmark relative flex items-baseline">
            <span className="text-[clamp(5rem,12vw,11rem)] font-bold tracking-tight leading-none text-foreground">
              Taysir
            </span>
            <span className="text-[clamp(5rem,12vw,11rem)] font-bold leading-none text-primary">
              .
            </span>
          </div>

          {/* Tagline, right of center, smaller */}
          <div className="splash-tagline absolute right-12 top-1/2 -translate-y-1/2 text-right text-base sm:text-lg text-muted-foreground leading-snug max-w-[14rem]">
            Tracking and<br />Organizing for<br />Non-Profits
          </div>
        </div>
      </div>

      <style>{`
        .splash-topbar {
          opacity: 0;
          animation: splashFade 700ms ease-out 100ms forwards;
        }
        .splash-arabic {
          font-size: clamp(14rem, 38vw, 32rem);
          letter-spacing: -0.02em;
          opacity: 0;
          transform: translate(20%, -50%) scale(1.02);
          animation: splashArabicIn 1800ms cubic-bezier(0.22, 1, 0.36, 1) 400ms forwards;
        }
        @keyframes splashArabicIn {
          0%   { opacity: 0; transform: translate(35%, -50%) scale(1.05); }
          100% { opacity: 1; transform: translate(20%, -50%) scale(1); }
        }
        .splash-wordmark {
          opacity: 0;
          transform: translateY(14px);
          animation: splashRise 800ms cubic-bezier(0.22, 1, 0.36, 1) 1300ms forwards;
        }
        .splash-tagline {
          opacity: 0;
          animation: splashFade 700ms ease-out 1900ms forwards;
        }
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
