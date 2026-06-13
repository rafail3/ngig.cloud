import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;

  let username = "";
  let role = "";
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, role")
      .eq("id", userId)
      .single();
    username = profile?.username ?? "";
    role = profile?.role ?? "";
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-900 px-6 py-3">
        <span className="font-semibold tracking-tight">
          ngig<span className="text-indigo-400">.cloud</span>
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-400">
            {username}
            {role === "admin" && (
              <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-xs text-indigo-300">
                admin
              </span>
            )}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex max-w-xl flex-col items-center gap-6">
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
        </div>
      </main>
    </div>
  );
}
