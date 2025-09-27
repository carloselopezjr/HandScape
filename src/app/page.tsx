import './globals.css';

export default function Home() {
  return (
    <main className="fade-in flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <h1 className="text-5xl font-bold">HandScape</h1>

      <div className="mt-6 h-64 w-64 rounded-full border border-white/20 grid place-items-center">
        <span className="opacity-70 text-sm">Solar System Placeholder</span>
      </div>


      <button className="mt-8 px-6 py-3 rounded-xl hover:opacity-80 transition" style={{ backgroundColor: "var(--foreground)", color: "var(--background)" }}>
      Enter World
      </button>

    </main>
  );
}
