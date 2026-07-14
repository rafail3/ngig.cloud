"use client";

import { useState, useTransition } from "react";
import { AnimatePresence } from "motion/react";
import { TriangleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "@/components/drive/anim";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { deleteMyAccountAction } from "@/app/(app)/profil/actions";

const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-red-500/15";

// Danger zone: irreversible account deletion. Two locks before the button arms —
// the current password (proves it's them) and the username typed by hand
// (proves they meant it). The server re-checks both.
export function DeleteAccount({ username }: { username: string }) {
  // "form" collects the credentials; "sure" is the final point-of-no-return
  // prompt, deliberately separate so the last click is its own decision.
  const [step, setStep] = useState<"closed" | "form" | "sure">("closed");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  const armed = password.length > 0 && confirm === username;

  function close() {
    if (pending) return;
    setStep("closed");
    setPassword("");
    setConfirm("");
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteMyAccountAction({ password, username: confirm });
      if (!res.ok) {
        toast.error(res.error);
        // Back to the fields — the server rejected something there (a wrong
        // password), and there's nothing to fix on the confirmation step.
        setStep("form");
        return;
      }
      // The session is gone with the account — a full load lands on /login and
      // drops every cached page along the way.
      window.location.assign("/login");
    });
  }

  return (
    <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100">Șterge contul</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Îți șterge definitiv contul, toate fișierele și tot istoricul. Nu poate fi anulat.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep("form")}
          className="shrink-0 rounded-lg border border-red-500/40 px-3.5 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
        >
          Șterge contul
        </button>
      </div>

      <AnimatePresence>
        {step === "form" && (
          <ModalShell key="del-account" onClose={close}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
              <TriangleAlert className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-100">
              Ștergi definitiv contul?
            </h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Dispar contul, toate fișierele din cloud, arhiva, coșul, ticketele de suport
              și tot istoricul. Acțiunea e <span className="font-medium text-zinc-300">ireversibilă</span>.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label htmlFor="del-password" className="mb-1 block text-sm font-medium text-zinc-300">
                  Parola ta
                </label>
                <PasswordInput
                  name="del-password"
                  autoComplete="current-password"
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="del-confirm" className="mb-1 block text-sm font-medium text-zinc-300">
                  Scrie <span className="font-mono text-zinc-100">{username}</span> ca să confirmi
                </label>
                <input
                  id="del-confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  placeholder={username}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => setStep("sure")}
                disabled={!armed}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500 disabled:opacity-50"
              >
                Continuă
              </button>
            </div>
          </ModalShell>
        )}

        {step === "sure" && (
          <ModalShell key="del-sure" onClose={close}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
              <TriangleAlert className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-100">
              Sigur ștergi contul?
            </h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Ăsta e ultimul pas. Odată confirmat, contul{" "}
              <span className="font-medium text-zinc-300">{username}</span> și toate datele
              lui dispar definitiv și nu mai pot fi recuperate.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? "Se șterge…" : "Da, șterge definitiv"}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </section>
  );
}
