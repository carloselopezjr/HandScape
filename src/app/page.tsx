import './globals.css';

export default function Home() {
  return (
    <main className="fade-in flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <h1 className="text-5xl font-bold">HandScape</h1>
      <p className="mt-4 text-lg text-center">
        Solar System Here
      </p>

      <button className="mt-8 px-6 py-3 rounded-xl hover:opacity-80 transition" style={{ backgroundColor: "var(--foreground)", color: "var(--background)" }}>
      Enter World
      </button>

    </main>
  );
}
