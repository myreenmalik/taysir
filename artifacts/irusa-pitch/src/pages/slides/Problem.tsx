export default function Problem() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-dark">
      <div className="absolute top-[12vh] left-[6vw] w-[30vw] h-[0.2vh] bg-accent/40" />
      <div className="absolute bottom-[10vh] right-[6vw] font-display text-[20vw] leading-none text-bg/[0.03] font-bold select-none">
        ?
      </div>

      <div className="relative z-10 h-full flex flex-col justify-between px-[7vw] py-[8vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[0.5vw] h-[3vh] bg-accent" />
          <span className="font-body text-[1vw] tracking-[0.3em] uppercase text-accent font-semibold">
            The Problem
          </span>
        </div>

        <div className="max-w-[75vw]">
          <h2 className="font-display text-[5.5vw] leading-[1.0] text-bg font-medium tracking-tight">
            World-class impact,
            <span className="block text-accent italic">spreadsheet-grade workflows.</span>
          </h2>
          <p className="font-body text-[1.5vw] text-bg/75 mt-[4vh] leading-relaxed font-light max-w-[55vw]">
            IRUSA&apos;s teams run seasonal campaigns, FRFs, donor follow-up,
            and masjid partnerships across dozens of disconnected
            Google Sheets, Excel files, and email threads.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-[2vw] max-w-[80vw]">
          <div className="border-t-[0.2vh] border-bg/30 pt-[2vh]">
            <div className="font-display text-[2.2vw] text-bg font-medium leading-tight">
              Scattered
            </div>
            <div className="font-body text-[1vw] text-bg/60 mt-[1vh]">
              Data spread across files no one can find
            </div>
          </div>
          <div className="border-t-[0.2vh] border-bg/30 pt-[2vh]">
            <div className="font-display text-[2.2vw] text-bg font-medium leading-tight">
              Manual
            </div>
            <div className="font-body text-[1vw] text-bg/60 mt-[1vh]">
              Every reconciliation done by hand
            </div>
          </div>
          <div className="border-t-[0.2vh] border-bg/30 pt-[2vh]">
            <div className="font-display text-[2.2vw] text-bg font-medium leading-tight">
              Reactive
            </div>
            <div className="font-body text-[1vw] text-bg/60 mt-[1vh]">
              Problems caught after they cost donors
            </div>
          </div>
        </div>

        <div className="font-body text-[1.1vw] text-accent italic max-w-[60vw]">
          Staff time spent fixing systems is staff time lost from helping people.
        </div>
      </div>
    </div>
  );
}
