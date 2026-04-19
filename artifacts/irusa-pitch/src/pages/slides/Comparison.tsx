export default function Comparison() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <div className="absolute top-0 left-0 w-full h-[35vh] bg-gradient-to-b from-cream to-bg" />

      <div className="relative z-10 h-full flex flex-col px-[7vw] py-[7vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[0.5vw] h-[3vh] bg-primary" />
          <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-primary font-semibold">
            Before / After
          </span>
        </div>

        <h2 className="font-display text-[4.5vw] leading-[1.0] text-dark font-medium tracking-tight mt-[2vh]">
          Spreadsheets
          <span className="text-muted/60"> vs. </span>
          <span className="italic text-primary">Tayseer.</span>
        </h2>

        <div className="mt-[5vh] grid grid-cols-12 gap-[2vw]">
          <div className="col-span-3" />
          <div className="col-span-4 font-body text-[1.1vw] tracking-[0.2em] uppercase text-muted font-semibold">
            Before — Spreadsheets
          </div>
          <div className="col-span-1" />
          <div className="col-span-4 font-body text-[1.1vw] tracking-[0.2em] uppercase text-primary font-semibold">
            After — Tayseer
          </div>
        </div>

        <div className="mt-[2vh] space-y-[1.6vh]">
          <div className="grid grid-cols-12 gap-[2vw] items-center py-[1.5vh] border-t border-muted/15">
            <div className="col-span-3 font-display text-[1.6vw] font-semibold text-dark">
              Data
            </div>
            <div className="col-span-4 font-body text-[1.2vw] text-muted">
              Scattered across files
            </div>
            <div className="col-span-1 font-body text-[1.2vw] text-accent text-center">→</div>
            <div className="col-span-4 font-body text-[1.2vw] text-dark font-medium">
              Centralized in one platform
            </div>
          </div>

          <div className="grid grid-cols-12 gap-[2vw] items-center py-[1.5vh] border-t border-muted/15">
            <div className="col-span-3 font-display text-[1.6vw] font-semibold text-dark">
              Workflows
            </div>
            <div className="col-span-4 font-body text-[1.2vw] text-muted">
              Manual reconciliation
            </div>
            <div className="col-span-1 font-body text-[1.2vw] text-accent text-center">→</div>
            <div className="col-span-4 font-body text-[1.2vw] text-dark font-medium">
              Structured &amp; automatic
            </div>
          </div>

          <div className="grid grid-cols-12 gap-[2vw] items-center py-[1.5vh] border-t border-muted/15">
            <div className="col-span-3 font-display text-[1.6vw] font-semibold text-dark">
              Insights
            </div>
            <div className="col-span-4 font-body text-[1.2vw] text-muted">
              Reactive — caught late
            </div>
            <div className="col-span-1 font-body text-[1.2vw] text-accent text-center">→</div>
            <div className="col-span-4 font-body text-[1.2vw] text-dark font-medium">
              Intelligent — surfaced early
            </div>
          </div>

          <div className="grid grid-cols-12 gap-[2vw] items-center py-[1.5vh] border-t border-b border-muted/15">
            <div className="col-span-3 font-display text-[1.6vw] font-semibold text-dark">
              Output
            </div>
            <div className="col-span-4 font-body text-[1.2vw] text-muted">
              Descriptive reports
            </div>
            <div className="col-span-1 font-body text-[1.2vw] text-accent text-center">→</div>
            <div className="col-span-4 font-body text-[1.2vw] text-dark font-medium">
              Actionable next-steps
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
