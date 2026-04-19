export default function Pillar2Funding() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-cream">
      <div className="absolute top-0 right-0 w-[8vw] h-full bg-accent" />
      <div className="absolute top-[8vh] left-[8vw] font-display text-[28vw] leading-none text-accent/[0.07] font-bold select-none">
        02
      </div>

      <div className="relative z-10 h-full grid grid-cols-12 gap-[3vw] pl-[7vw] pr-[12vw] py-[8vh]">
        <div className="col-span-5 flex flex-col justify-center">
          <div className="bg-bg rounded-[1.5vh] p-[3vh] border border-accent/20 shadow-[0_2px_20px_rgba(201,162,76,0.08)]">
            <div className="font-body text-[0.9vw] tracking-[0.2em] uppercase text-muted mb-[1.5vh]">
              FRF Reconciliation
            </div>

            <div className="space-y-[1.5vh]">
              <div className="flex justify-between items-center pb-[1vh] border-b border-accent/15">
                <div>
                  <div className="font-body text-[1.1vw] font-medium text-dark">
                    Cash Collected
                  </div>
                  <div className="font-body text-[0.85vw] text-muted">
                    Per FRF entries
                  </div>
                </div>
                <div className="font-display text-[1.8vw] font-semibold text-dark">
                  $12,400
                </div>
              </div>
              <div className="flex justify-between items-center pb-[1vh] border-b border-accent/15">
                <div>
                  <div className="font-body text-[1.1vw] font-medium text-dark">
                    Card / Online
                  </div>
                  <div className="font-body text-[0.85vw] text-muted">
                    Stripe + manual
                  </div>
                </div>
                <div className="font-display text-[1.8vw] font-semibold text-dark">
                  $48,200
                </div>
              </div>
              <div className="flex justify-between items-center pb-[1vh] border-b border-accent/15">
                <div>
                  <div className="font-body text-[1.1vw] font-medium text-dark">
                    Pledges
                  </div>
                  <div className="font-body text-[0.85vw] text-muted">
                    Ramadan recurring
                  </div>
                </div>
                <div className="font-display text-[1.8vw] font-semibold text-dark">
                  $23,400
                </div>
              </div>
              <div className="flex justify-between items-center pt-[1vh]">
                <div className="font-display text-[1.4vw] font-bold text-primary">
                  Total Reconciled
                </div>
                <div className="font-display text-[2.4vw] font-bold text-primary">
                  $84,000
                </div>
              </div>
            </div>

            <div className="mt-[2vh] bg-accent/10 border-l-[0.4vw] border-accent rounded-[0.5vh] px-[1.5vh] py-[1.2vh]">
              <div className="font-body text-[0.9vw] tracking-[0.15em] uppercase text-accent font-semibold">
                Flag
              </div>
              <div className="font-body text-[1vw] text-dark mt-[0.3vh]">
                Cash count off by $200 vs. attendee receipts
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-7 flex flex-col justify-center">
          <div className="flex items-center gap-[1vw]">
            <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-accent font-semibold">
              Pillar 02
            </span>
            <div className="w-[3vw] h-[0.15vh] bg-accent/50" />
          </div>

          <h2 className="font-display text-[5vw] leading-[0.95] text-dark font-medium tracking-tight mt-[2vh]">
            Funding &amp;
            <span className="block italic text-accent">FRF Reconciliation.</span>
          </h2>
          <p className="font-body text-[1.4vw] text-muted mt-[2vh] leading-relaxed font-light max-w-[40vw]">
            Replace manual spreadsheets with structured finance tracking
            that catches mismatches before they become losses.
          </p>

          <div className="mt-[4vh] grid grid-cols-2 gap-[2vh] max-w-[40vw]">
            <div className="font-body text-[1.1vw] text-dark">
              <span className="font-semibold text-accent">— </span>
              Money raised by type
            </div>
            <div className="font-body text-[1.1vw] text-dark">
              <span className="font-semibold text-accent">— </span>
              Automatic FRF matching
            </div>
            <div className="font-body text-[1.1vw] text-dark">
              <span className="font-semibold text-accent">— </span>
              Allocation tracking by cause
            </div>
            <div className="font-body text-[1.1vw] text-dark">
              <span className="font-semibold text-accent">— </span>
              Mismatch &amp; missing-FRF flags
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
