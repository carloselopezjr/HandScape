import './globals.css';

export default function Home() {
  return (
    
    <main className="fade-in relative min-h-screen flex flex-col bg-background text-foreground">

      {/* title */}
      <h1 className="mt-16 text-5xl font-bold text-center">HandScape</h1>

    
      {/* Solar System */}
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="h-64 w-64 rounded-full border border-white/20 grid place-items-center">
          <span className="opacity-70 text-sm">Solar System Placeholder</span>
        </div>
      </div>

      {/* Enter World */}
      <button
        className="mb-12 px-6 py-3 rounded-xl hover:opacity-80 transition self-center"
        style={{ backgroundColor: "var(--foreground)", color: "var(--background)" }}
      >
        Enter World
      </button>
    </main>
  );
}

