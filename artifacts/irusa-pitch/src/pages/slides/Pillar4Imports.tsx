export default function Pillar4Imports() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cream">
      <div className="absolute top-0 right-0 w-[8vw] h-full bg-accent" />
      <div className="absolute top-[8vh] left-[8vw] font-display text-[28vw] leading-none text-accent/[0.07] font-bold select-none">
        04
      </div>

      <div className="relative z-10 h-full grid grid-cols-12 gap-[3vw] pl-[7vw] pr-[12vw] py-[8vh]">
        <div className="col-span-6 flex flex-col justify-center">
          <div className="bg-bg rounded-[1.5vh] p-[3vh] border border-accent/20">
            <div className="font-body text-[0.9vw] tracking-[0.2em] uppercase text-muted mb-[2vh]">
              AI Column Mapping
            </div>

            <div className="space-y-[1.2vh]">
              <div className="grid grid-cols-12 items-center gap-[1vw]">
                <div className="col-span-5 font-body text-[1vw] text-muted bg-cream rounded px-[1vh] py-[0.6vh] truncate">
                  &ldquo;Donor Full Name&rdquo;
                </div>
                <div className="col-span-2 font-body text-[1vw] text-accent text-center">→</div>
                <div className="col-span-5 font-body text-[1vw] font-semibold text-primary bg-primary/10 rounded px-[1vh] py-[0.6vh]">
                  donor.name
                </div>
              </div>
              <div className="grid grid-cols-12 items-center gap-[1vw]">
                <div className="col-span-5 font-body text-[1vw] text-muted bg-cream rounded px-[1vh] py-[0.6vh] truncate">
                  &ldquo;$ Amount&rdquo;
                </div>
                <div className="col-span-2 font-body text-[1vw] text-accent text-center">→</div>
                <div className="col-span-5 font-body text-[1vw] font-semibold text-primary bg-primary/10 rounded px-[1vh] py-[0.6vh]">
                  donation.amount
                </div>
              </div>
              <div className="grid grid-cols-12 items-center gap-[1vw]">
                <div className="col-span-5 font-body text-[1vw] text-muted bg-cream rounded px-[1vh] py-[0.6vh] truncate">
                  &ldquo;Pmt Method&rdquo;
                </div>
                <div className="col-span-2 font-body text-[1vw] text-accent text-center">→</div>
                <div className="col-span-5 font-body text-[1vw] font-semibold text-primary bg-primary/10 rounded px-[1vh] py-[0.6vh]">
                  donation.method
                </div>
              </div>
              <div className="grid grid-cols-12 items-center gap-[1vw]">
                <div className="col-span-5 font-body text-[1vw] text-muted bg-cream rounded px-[1vh] py-[0.6vh] truncate">
                  &ldquo;Fund / Cause&rdquo;
                </div>
                <div className="col-span-2 font-body text-[1vw] text-accent text-center">→</div>
                <div className="col-span-5 font-body text-[1vw] font-semibold text-primary bg-primary/10 rounded px-[1vh] py-[0.6vh]">
                  donation.cause
                </div>
              </div>
            </div>

            <div className="mt-[2.5vh] flex items-center gap-[1vh] text-primary">
              <div className="font-body text-[0.9vw] font-semibold tracking-wider uppercase">
                ✓ Mapped in seconds — no fixed template required
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-6 flex flex-col justify-center">
          <div className="flex items-center gap-[1vw]">
            <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-accent font-semibold">
              Pillar 04
            </span>
            <div className="w-[3vw] h-[0.15vh] bg-accent/50" />
          </div>

          <h2 className="font-display text-[4.6vw] leading-[0.95] text-dark font-medium tracking-tight mt-[2vh]">
            Smart Imports
            <span className="block italic text-accent">&amp; Live Alerts.</span>
          </h2>
          <p className="font-body text-[1.3vw] text-muted mt-[2vh] leading-relaxed font-light max-w-[36vw]">
            Drop in any messy CSV — AI maps every column. The system
            then continuously scans for the things humans miss.
          </p>

          <div className="mt-[3.5vh] space-y-[1.3vh] max-w-[36vw]">
            <div className="font-body text-[1.1vw] text-dark">
              <span className="font-semibold text-accent">— </span>
              Missing FRF for completed events
            </div>
            <div className="font-body text-[1.1vw] text-dark">
              <span className="font-semibold text-accent">— </span>
              Revenue mismatches between sources
            </div>
            <div className="font-body text-[1.1vw] text-dark">
              <span className="font-semibold text-accent">— </span>
              Lapsed major donors needing outreach
            </div>
            <div className="font-body text-[1.1vw] text-dark">
              <span className="font-semibold text-accent">— </span>
              Auto-generated, cause-aware follow-ups
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
