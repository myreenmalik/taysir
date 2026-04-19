const base = import.meta.env.BASE_URL;

export default function Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-dark">
      <img
        src={`${base}hero-aid.png`}
        crossOrigin="anonymous"
        alt="Humanitarian aid volunteers"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-dark/90 via-dark/60 to-dark/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />

      <div className="relative z-10 h-full flex flex-col justify-between px-[7vw] py-[7vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[0.5vw] h-[3vh] bg-accent" />
          <span className="font-body text-[1.2vw] tracking-[0.3em] uppercase text-accent font-semibold">
            HackMSA 2026 — IRUSA Track
          </span>
        </div>

        <div className="max-w-[70vw]">
          <p className="font-body text-[1.4vw] tracking-[0.25em] uppercase text-cream/80 font-medium mb-[2vh]">
            Smart Event &amp; Donor Intelligence
          </p>
          <h1 className="font-display text-[8vw] leading-[0.92] font-medium text-bg tracking-tight">
            Tayseer.
          </h1>
          <p className="font-body text-[1.6vw] text-bg/85 mt-[3vh] max-w-[55vw] leading-relaxed font-light">
            One platform for IRUSA&apos;s events, donors, and FRFs —
            replacing the patchwork of spreadsheets with connected intelligence.
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div className="font-body text-[1vw] tracking-[0.3em] uppercase text-cream/60">
            Built for Islamic Relief USA
          </div>
          <div className="font-body text-[1vw] tracking-[0.3em] uppercase text-cream/60">
            Pitch Deck — 2026
          </div>
        </div>
      </div>
    </div>
  );
}
