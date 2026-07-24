"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import type { SharePageData } from "@/lib/share";
import { unlockShareAction } from "@/app/drive-actions";
import { ShareContent } from "./ShareContent";

// Password prompt for a protected link. On the correct password the server
// returns the full payload (and sets the unlock cookie for downloads), and we
// render the content in place.
export function ShareGate({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharePageData | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    const res = await unlockShareAction(token, password);
    setBusy(false);
    if ("gone" in res) {
      setError("Linkul nu mai există sau a expirat.");
      return;
    }
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setData(res.data);
  }

  if (data) return <ShareContent token={token} data={data} />;

  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-300">
          <Lock className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-center text-lg font-semibold text-zinc-50">
          Link protejat cu parolă
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-center text-sm text-zinc-400">
          Introdu parola primită pentru a vedea conținutul.
        </p>

        <form onSubmit={submit} className="mt-6">
          <div className="relative">
            <input
              autoFocus
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Parolă"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3.5 py-2.5 pr-11 text-sm text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/40"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Ascunde parola" : "Arată parola"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition hover:text-zinc-200"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || !password}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {busy ? "Se verifică…" : "Deblochează"}
          </button>
        </form>
      </div>
    </div>
  );
}
