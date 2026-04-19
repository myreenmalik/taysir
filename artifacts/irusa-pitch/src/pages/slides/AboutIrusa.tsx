export default function AboutIrusa() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg">
      <div className="absolute top-0 right-0 w-[40vw] h-full bg-cream" />
      <div className="absolute top-[8vh] right-[8vw] w-[8vw] h-[8vw] rounded-full bg-primary/10" />

      <div className="relative z-10 h-full grid grid-cols-12 gap-[3vw] px-[7vw] py-[8vh]">
        <div className="col-span-5 flex flex-col justify-between">
          <div className="flex items-center gap-[1vw]">
            <div className="w-[0.5vw] h-[3vh] bg-primary" />
            <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-primary font-semibold">
              Who We Build For
            </span>
          </div>

          <div>
            <h2 className="font-display text-[5vw] leading-[0.95] text-dark font-medium tracking-tight">
              Islamic Relief
              <span className="block text-primary italic">USA.</span>
            </h2>
            <p className="font-body text-[1.4vw] text-muted mt-[3vh] leading-relaxed font-light max-w-[28vw]">
              One of the largest American Muslim-led humanitarian
              organizations — serving communities across 40+ countries.
            </p>
          </div>

          <div className="font-body text-[0.95vw] text-muted/70 italic">
            Source: Islamic Relief USA annual reports
          </div>
        </div>

        <div className="col-span-7 flex flex-col justify-center gap-[3vh]">
          <div className="border-l-[0.4vw] border-primary pl-[2vw]">
            <div className="font-display text-[6vw] font-bold text-dark leading-none tracking-tight">
              40+
            </div>
            <div className="font-body text-[1.2vw] text-muted mt-[0.5vh] uppercase tracking-wider">
              Countries reached with humanitarian aid
            </div>
          </div>

          <div className="border-l-[0.4vw] border-accent pl-[2vw]">
            <div className="font-display text-[6vw] font-bold text-dark leading-none tracking-tight">
              $100M+
            </div>
            <div className="font-body text-[1.2vw] text-muted mt-[0.5vh] uppercase tracking-wider">
              Annually raised through events &amp; donor giving
            </div>
          </div>

          <div className="border-l-[0.4vw] border-primary/50 pl-[2vw]">
            <div className="font-display text-[6vw] font-bold text-dark leading-none tracking-tight">
              1,000s
            </div>
            <div className="font-body text-[1.2vw] text-muted mt-[0.5vh] uppercase tracking-wider">
              Donors, masjid partnerships, &amp; seasonal campaigns
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
