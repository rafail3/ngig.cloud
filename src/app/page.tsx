export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 text-center font-sans text-zinc-50">
      <main className="flex max-w-xl flex-col items-center gap-6">
        <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium tracking-wide text-zinc-400">
          v0 · private beta
        </span>
        <h1 className="text-5xl font-semibold tracking-tight">
          ngig<span className="text-indigo-400">.cloud</span>
        </h1>
        <p className="text-lg leading-8 text-zinc-400">
          Cloud personal, pe invitație. Stocare, acces securizat și control
          total asupra fișierelor tale.
        </p>
        <p className="text-sm text-zinc-600">
          Accesul se face cu cont și parolă, pe baza unui cod de invitație.
        </p>
      </main>
      <footer className="absolute bottom-6 text-xs text-zinc-700">
        © {new Date().getFullYear()} ngig.cloud
      </footer>
    </div>
  );
}
