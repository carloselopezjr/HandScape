import './globals.css';

export default function Home() {
  return (
    
    <main className="fade-in relative min-h-screen flex flex-col bg-background text-foreground">

      <div className="starfield"></div>

      {/* title */}
      <h1 className="mt-16 text-5xl font-bold text-center">HandScape</h1>

    
      {/* Solar System */}
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="h-64 w-64 rounded-full border border-white/20 grid place-items-center">
          <span className="opacity-70 text-sm">Solar System Placeholder</span>
        </div>
      </div>

      {/* Enter World */}
      <button className="mb-25 self-center relative inline-flex h-16 w-50 overflow-hidden rounded-2xl p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50">
        <span className="absolute inset-[-1000%] animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
        <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-2xl bg-slate-950 px-3 py-1 text-lg font-medium text-white backdrop-blur-3xl">
          Enter World
        </span>
      </button>

    </main>
  );
}

