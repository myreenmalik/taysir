export default function Solution() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <div className="absolute top-0 left-0 w-full h-[35vh] bg-gradient-to-b from-cream to-bg" />

      <div className="relative z-10 h-full flex flex-col px-[7vw] py-[7vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[0.5vw] h-[3vh] bg-primary" />
          <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-primary font-semibold">
            Our Product
          </span>
        </div>

        <div className="mt-[3vh] max-w-[70vw]">
          <h2 className="font-display text-[5vw] leading-[0.95] text-dark font-medium tracking-tight">
            Tayseer
            <span className="text-primary"> — </span>
            <span className="italic font-normal">one platform,</span>
            <span className="block">four connected pillars.</span>
          </h2>
          <p className="font-body text-[1.4vw] text-muted mt-[2vh] leading-relaxed font-light max-w-[55vw]">
            A single source of truth for IRUSA&apos;s events, donors, finances,
            and outreach — with AI-driven recommendations baked in.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-[2vw] mt-auto">
          <div className="bg-cream rounded-[1vh] p-[2.5vh] border-t-[0.5vh] border-primary">
            <div className="font-display text-[2.5vw] font-bold text-primary leading-none">
              01
            </div>
            <div className="font-display text-[1.7vw] font-semibold text-dark mt-[1.5vh] leading-tight">
              Event Operations
            </div>
            <div className="font-body text-[1vw] text-muted mt-[1vh] leading-relaxed">
              Full event lifecycle — logistics, attendance, status — in one view.
            </div>
          </div>

          <div className="bg-cream rounded-[1vh] p-[2.5vh] border-t-[0.5vh] border-accent">
            <div className="font-display text-[2.5vw] font-bold text-accent leading-none">
              02
            </div>
            <div className="font-display text-[1.7vw] font-semibold text-dark mt-[1.5vh] leading-tight">
              Funding &amp; FRFs
            </div>
            <div className="font-body text-[1vw] text-muted mt-[1vh] leading-relaxed">
              Structured finance tracking, automatic FRF reconciliation, error flags.
            </div>
          </div>

          <div className="bg-cream rounded-[1vh] p-[2.5vh] border-t-[0.5vh] border-primary">
            <div className="font-display text-[2.5vw] font-bold text-primary leading-none">
              03
            </div>
            <div className="font-display text-[1.7vw] font-semibold text-dark mt-[1.5vh] leading-tight">
              Donor Intelligence
            </div>
            <div className="font-body text-[1vw] text-muted mt-[1vh] leading-relaxed">
              Giving history, segments, and personalized next-step recommendations.
            </div>
          </div>

          <div className="bg-cream rounded-[1vh] p-[2.5vh] border-t-[0.5vh] border-accent">
            <div className="font-display text-[2.5vw] font-bold text-accent leading-none">
              04
            </div>
            <div className="font-display text-[1.7vw] font-semibold text-dark mt-[1.5vh] leading-tight">
              Smart Imports &amp; Alerts
            </div>
            <div className="font-body text-[1vw] text-muted mt-[1vh] leading-relaxed">
              AI maps any spreadsheet; alerts surface FRF gaps and lapsed donors.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
