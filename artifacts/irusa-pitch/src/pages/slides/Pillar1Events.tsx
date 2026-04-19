export default function Pillar1Events() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <div className="absolute top-0 left-0 w-[8vw] h-full bg-primary" />
      <div className="absolute bottom-[8vh] right-[8vw] font-display text-[28vw] leading-none text-primary/[0.05] font-bold select-none">
        01
      </div>

      <div className="relative z-10 h-full grid grid-cols-12 gap-[3vw] pl-[12vw] pr-[7vw] py-[8vh]">
        <div className="col-span-7 flex flex-col justify-center">
          <div className="flex items-center gap-[1vw]">
            <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-primary font-semibold">
              Pillar 01
            </span>
            <div className="w-[3vw] h-[0.15vh] bg-primary/40" />
          </div>

          <h2 className="font-display text-[5vw] leading-[0.95] text-dark font-medium tracking-tight mt-[2vh]">
            Event Operations
          </h2>
          <p className="font-body text-[1.4vw] text-muted mt-[2vh] leading-relaxed font-light max-w-[42vw]">
            Track the full event lifecycle in one place — from kickoff
            to revenue reconciliation.
          </p>

          <div className="mt-[5vh] grid grid-cols-2 gap-x-[2vw] gap-y-[2vh] max-w-[42vw]">
            <div className="border-l-[0.3vw] border-primary pl-[1.2vw]">
              <div className="font-display text-[1.5vw] font-semibold text-dark">
                Event Details
              </div>
              <div className="font-body text-[1vw] text-muted mt-[0.3vh]">
                Date, venue, capacity, masjid partner
              </div>
            </div>
            <div className="border-l-[0.3vw] border-primary pl-[1.2vw]">
              <div className="font-display text-[1.5vw] font-semibold text-dark">
                Logistics Checklist
              </div>
              <div className="font-body text-[1vw] text-muted mt-[0.3vh]">
                Permits, A/V, catering — tracked, not forgotten
              </div>
            </div>
            <div className="border-l-[0.3vw] border-primary pl-[1.2vw]">
              <div className="font-display text-[1.5vw] font-semibold text-dark">
                Attendance
              </div>
              <div className="font-body text-[1vw] text-muted mt-[0.3vh]">
                Live check-in tied to donor records
              </div>
            </div>
            <div className="border-l-[0.3vw] border-primary pl-[1.2vw]">
              <div className="font-display text-[1.5vw] font-semibold text-dark">
                Status Tracking
              </div>
              <div className="font-body text-[1vw] text-muted mt-[0.3vh]">
                Planned, active, completed, reconciled
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-5 flex flex-col justify-center">
          <div className="bg-cream rounded-[1.5vh] p-[3vh] border border-primary/10">
            <div className="font-body text-[0.9vw] tracking-[0.2em] uppercase text-muted mb-[1.5vh]">
              Event Snapshot
            </div>
            <div className="font-display text-[2.4vw] font-semibold text-dark leading-tight">
              Lebanon Relief Dinner
            </div>
            <div className="font-body text-[1.1vw] text-muted mt-[0.5vh]">
              Houston, TX · Apr 2026
            </div>
            <div className="h-[0.1vh] bg-primary/15 my-[2.5vh]" />
            <div className="grid grid-cols-2 gap-[2vh]">
              <div>
                <div className="font-display text-[2.5vw] font-bold text-primary leading-none">
                  240
                </div>
                <div className="font-body text-[0.9vw] text-muted mt-[0.5vh] uppercase tracking-wider">
                  Attended
                </div>
              </div>
              <div>
                <div className="font-display text-[2.5vw] font-bold text-primary leading-none">
                  $84K
                </div>
                <div className="font-body text-[0.9vw] text-muted mt-[0.5vh] uppercase tracking-wider">
                  Raised
                </div>
              </div>
              <div>
                <div className="font-display text-[2.5vw] font-bold text-accent leading-none">
                  92%
                </div>
                <div className="font-body text-[0.9vw] text-muted mt-[0.5vh] uppercase tracking-wider">
                  Reconciled
                </div>
              </div>
              <div>
                <div className="font-display text-[2.5vw] font-bold text-accent leading-none">
                  3
                </div>
                <div className="font-body text-[0.9vw] text-muted mt-[0.5vh] uppercase tracking-wider">
                  Open Items
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
