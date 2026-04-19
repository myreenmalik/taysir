export default function Pillar3Donors() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <div className="absolute top-0 left-0 w-[8vw] h-full bg-primary" />
      <div className="absolute bottom-[8vh] right-[8vw] font-display text-[28vw] leading-none text-primary/[0.05] font-bold select-none">
        03
      </div>

      <div className="relative z-10 h-full grid grid-cols-12 gap-[3vw] pl-[12vw] pr-[7vw] py-[8vh]">
        <div className="col-span-6 flex flex-col justify-center">
          <div className="flex items-center gap-[1vw]">
            <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-primary font-semibold">
              Pillar 03
            </span>
            <div className="w-[3vw] h-[0.15vh] bg-primary/40" />
          </div>

          <h2 className="font-display text-[5vw] leading-[0.95] text-dark font-medium tracking-tight mt-[2vh]">
            Donor
            <span className="block italic text-primary">Intelligence.</span>
          </h2>
          <p className="font-body text-[1.4vw] text-muted mt-[2vh] leading-relaxed font-light max-w-[38vw]">
            Help staff understand each donor and personalize follow-up
            without writing every email by hand.
          </p>

          <div className="mt-[4vh] space-y-[1.8vh] max-w-[38vw]">
            <div className="border-l-[0.3vw] border-primary pl-[1.2vw]">
              <div className="font-display text-[1.5vw] font-semibold text-dark">
                Profile &amp; Giving History
              </div>
              <div className="font-body text-[1vw] text-muted mt-[0.3vh]">
                Lifetime total, gift count, top causes, last donation
              </div>
            </div>
            <div className="border-l-[0.3vw] border-primary pl-[1.2vw]">
              <div className="font-display text-[1.5vw] font-semibold text-dark">
                Event Attendance + Giving
              </div>
              <div className="font-body text-[1vw] text-muted mt-[0.3vh]">
                Tied together so behavior is one story
              </div>
            </div>
            <div className="border-l-[0.3vw] border-primary pl-[1.2vw]">
              <div className="font-display text-[1.5vw] font-semibold text-dark">
                Segments + Recommendations
              </div>
              <div className="font-body text-[1vw] text-muted mt-[0.3vh]">
                Recurring · Major · Lapsed · One-time · Seasonal
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-6 flex flex-col justify-center">
          <div className="bg-cream rounded-[1.5vh] p-[3vh] border border-primary/10">
            <div className="flex items-start justify-between mb-[2vh]">
              <div>
                <div className="font-body text-[0.9vw] tracking-[0.2em] uppercase text-muted">
                  Donor Profile
                </div>
                <div className="font-display text-[2.2vw] font-semibold text-dark mt-[0.5vh] leading-tight">
                  Maryam Siddiqui
                </div>
              </div>
              <div className="bg-primary text-bg font-body text-[0.85vw] font-semibold uppercase tracking-wider px-[1vw] py-[0.5vh] rounded-full">
                Recurring
              </div>
            </div>

            <div className="grid grid-cols-3 gap-[1vh] mb-[2.5vh]">
              <div>
                <div className="font-display text-[1.8vw] font-bold text-dark">$4,200</div>
                <div className="font-body text-[0.85vw] text-muted uppercase tracking-wider">Lifetime</div>
              </div>
              <div>
                <div className="font-display text-[1.8vw] font-bold text-dark">14</div>
                <div className="font-body text-[0.85vw] text-muted uppercase tracking-wider">Gifts</div>
              </div>
              <div>
                <div className="font-display text-[1.8vw] font-bold text-dark">Orphans</div>
                <div className="font-body text-[0.85vw] text-muted uppercase tracking-wider">Top Cause</div>
              </div>
            </div>

            <div className="bg-bg border-l-[0.4vw] border-primary rounded-[0.5vh] px-[1.5vh] py-[1.5vh]">
              <div className="font-body text-[0.9vw] tracking-[0.15em] uppercase text-primary font-semibold mb-[0.5vh]">
                Suggested Action
              </div>
              <div className="font-body text-[1.1vw] text-dark leading-snug font-medium">
                Upgrade ask for recurring orphan-support donor
              </div>
              <div className="font-body text-[0.95vw] text-muted leading-relaxed mt-[1vh] italic">
                &ldquo;As-salamu alaykum Maryam — your 14 gifts toward orphan
                care over the past year have made a real difference...&rdquo;
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
