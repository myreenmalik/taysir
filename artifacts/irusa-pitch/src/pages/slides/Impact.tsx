export default function Impact() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <div className="absolute top-0 right-0 w-[45vw] h-full bg-primary" />
      <div
        dir="rtl"
        lang="ar"
        className="absolute bottom-[6vh] right-[6vw] font-arabic text-[22vw] leading-none text-bg/[0.07] select-none"
      >
        تيسير
      </div>

      <div className="relative z-10 h-full grid grid-cols-12 gap-[3vw] px-[7vw] py-[8vh]">
        <div className="col-span-5 flex flex-col justify-between">
          <div className="flex items-center gap-[1vw]">
            <div className="w-[0.5vw] h-[3vh] bg-primary" />
            <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-primary font-semibold">
              The Impact
            </span>
          </div>

          <div>
            <h2 className="font-display text-[5vw] leading-[0.95] text-dark font-medium tracking-tight">
              Less time on
              <span className="block italic text-primary">spreadsheets,</span>
              more time on
              <span className="block italic text-primary">people.</span>
            </h2>
            <p className="font-body text-[1.3vw] text-muted mt-[3vh] leading-relaxed font-light max-w-[34vw]">
              Tayseer gives IRUSA staff back the hours lost to operational
              friction — and gives donors the personalized care they deserve.
            </p>
          </div>

          <div className="font-body text-[1vw] text-muted/70 italic">
            Built with React, Express, PostgreSQL &amp; OpenAI.
          </div>
        </div>

        <div className="col-span-7 flex flex-col justify-center gap-[2.5vh]">
          <div className="bg-bg/10 backdrop-blur-sm border-l-[0.4vw] border-accent pl-[2vw] py-[1.5vh]">
            <div className="font-display text-[2.4vw] font-semibold text-bg leading-tight">
              Less human error
            </div>
            <div className="font-body text-[1.1vw] text-bg/75 mt-[0.5vh] leading-relaxed">
              Validation, alerts, and FRF matching catch what eyes miss.
            </div>
          </div>

          <div className="bg-bg/10 backdrop-blur-sm border-l-[0.4vw] border-accent pl-[2vw] py-[1.5vh]">
            <div className="font-display text-[2.4vw] font-semibold text-bg leading-tight">
              Better donor retention
            </div>
            <div className="font-body text-[1.1vw] text-bg/75 mt-[0.5vh] leading-relaxed">
              Cause-aware, personalized outreach — never another missed thank-you.
            </div>
          </div>

          <div className="bg-bg/10 backdrop-blur-sm border-l-[0.4vw] border-accent pl-[2vw] py-[1.5vh]">
            <div className="font-display text-[2.4vw] font-semibold text-bg leading-tight">
              Smarter campaign targeting
            </div>
            <div className="font-body text-[1.1vw] text-bg/75 mt-[0.5vh] leading-relaxed">
              Segment by cause &amp; behavior to invite the right donors first.
            </div>
          </div>

          <div className="bg-bg/10 backdrop-blur-sm border-l-[0.4vw] border-accent pl-[2vw] py-[1.5vh]">
            <div className="font-display text-[2.4vw] font-semibold text-bg leading-tight">
              Stronger use of staff time
            </div>
            <div className="font-body text-[1.1vw] text-bg/75 mt-[0.5vh] leading-relaxed">
              Hours reclaimed go back to the mission — helping people.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
