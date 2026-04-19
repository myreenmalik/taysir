const base = import.meta.env.BASE_URL;

export default function Demo() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-dark">
      <img
        src={`${base}community-dinner.png`}
        crossOrigin="anonymous"
        alt="Community fundraising dinner"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-dark via-dark/85 to-dark/40" />

      <div className="relative z-10 h-full grid grid-cols-12 gap-[3vw] px-[7vw] py-[7vh]">
        <div className="col-span-5 flex flex-col justify-between">
          <div className="flex items-center gap-[1vw]">
            <div className="w-[0.5vw] h-[3vh] bg-accent" />
            <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-accent font-semibold">
              Walkthrough
            </span>
          </div>

          <div>
            <p className="font-body text-[1.3vw] text-bg/70 uppercase tracking-[0.2em] font-medium mb-[2vh]">
              Scenario
            </p>
            <h2 className="font-display text-[5vw] leading-[0.95] text-bg font-medium tracking-tight">
              IRUSA runs a
              <span className="block italic text-accent">Lebanon Campaign.</span>
            </h2>
            <p className="font-body text-[1.3vw] text-bg/75 mt-[3vh] leading-relaxed font-light max-w-[32vw]">
              One coherent flow — from event creation through follow-up —
              powered by everything connecting in one system.
            </p>
          </div>

          <div className="font-body text-[1vw] text-bg/50 italic">
            Live walkthrough begins after this slide.
          </div>
        </div>

        <div className="col-span-7 flex flex-col justify-center">
          <div className="space-y-[1.4vh]">
            <div className="flex items-start gap-[1.5vw] bg-bg/[0.06] backdrop-blur-sm border border-bg/15 rounded-[1vh] p-[1.8vh]">
              <div className="font-display text-[2vw] font-bold text-accent leading-none w-[3vw]">01</div>
              <div className="flex-1">
                <div className="font-display text-[1.4vw] font-semibold text-bg">Create the event</div>
                <div className="font-body text-[1vw] text-bg/65 mt-[0.3vh]">Lebanon Relief Dinner — venue, capacity, masjid partner</div>
              </div>
            </div>

            <div className="flex items-start gap-[1.5vw] bg-bg/[0.06] backdrop-blur-sm border border-bg/15 rounded-[1vh] p-[1.8vh]">
              <div className="font-display text-[2vw] font-bold text-accent leading-none w-[3vw]">02</div>
              <div className="flex-1">
                <div className="font-display text-[1.4vw] font-semibold text-bg">Log attendance &amp; donations</div>
                <div className="font-body text-[1vw] text-bg/65 mt-[0.3vh]">Live check-in, gifts attached to donor records</div>
              </div>
            </div>

            <div className="flex items-start gap-[1.5vw] bg-bg/[0.06] backdrop-blur-sm border border-bg/15 rounded-[1vh] p-[1.8vh]">
              <div className="font-display text-[2vw] font-bold text-accent leading-none w-[3vw]">03</div>
              <div className="flex-1">
                <div className="font-display text-[1.4vw] font-semibold text-bg">Reconcile the FRF</div>
                <div className="font-body text-[1vw] text-bg/65 mt-[0.3vh]">Cash, card, and pledges match — flags surface gaps</div>
              </div>
            </div>

            <div className="flex items-start gap-[1.5vw] bg-bg/[0.06] backdrop-blur-sm border border-bg/15 rounded-[1vh] p-[1.8vh]">
              <div className="font-display text-[2vw] font-bold text-accent leading-none w-[3vw]">04</div>
              <div className="flex-1">
                <div className="font-display text-[1.4vw] font-semibold text-bg">Open a donor profile</div>
                <div className="font-body text-[1vw] text-bg/65 mt-[0.3vh]">Giving history, segment, and personalized email draft</div>
              </div>
            </div>

            <div className="flex items-start gap-[1.5vw] bg-bg/[0.06] backdrop-blur-sm border border-bg/15 rounded-[1vh] p-[1.8vh]">
              <div className="font-display text-[2vw] font-bold text-accent leading-none w-[3vw]">05</div>
              <div className="flex-1">
                <div className="font-display text-[1.4vw] font-semibold text-bg">End on the dashboard</div>
                <div className="font-body text-[1vw] text-bg/65 mt-[0.3vh]">Alerts, KPIs, and next-best actions all in one view</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
