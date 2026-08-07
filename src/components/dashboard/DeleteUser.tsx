"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";
import { AnimatePresence } from "motion/react";
import { TriangleAlert, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ModalShell } from "@/components/drive/anim";
import { deleteUserAction } from "@/app/dashboard/(panel)/users/actions";

// Admin-side account deletion. Same lock as the self-service flow: the username
// must be typed by hand, because this wipes someone else's files for good.
export function DeleteUser({ id, username }: { id: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setConfirm("");
  }

  /* On success the action redirects, so nothing after the await runs — only a
     REFUSAL comes back here. The confirmation toast is raised by the users list
     when it lands (see the `?sters=` param), because this component is gone by
     then. Navigating from the client instead is what produced the 404: the page
     we are on 404s the moment the account is gone, and its re-render beat the
     push. */
  function remove() {
    startTransition(async () => {
      // Optional chaining is not paranoia: on success this call never resolves
      // to a value — the redirect takes over — and reading `.error` off nothing
      // would throw right where the user is being told it worked.
      const res = await deleteUserAction({ id, username: confirm });
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-zinc-100">
        <TriangleAlert className="h-5 w-5 text-red-400" />
        <h2 className="text-base font-semibold">Șterge contul</h2>
      </div>
      <p className="mb-3 text-sm text-zinc-400">
        Șterge definitiv contul, toate fișierele din B2, ticketele de suport și tot
        istoricul acestui utilizator. Acțiunea nu poate fi anulată.
      </p>
      <Button variant="unstyled"
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 self-start rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
      >
        <Trash2 className="h-4 w-4" /> Șterge contul
      </Button>

      <AnimatePresence>
        {open && (
          <ModalShell key="del-user" onClose={close}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-900/50 bg-red-950/40">
              <TriangleAlert className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-100">
              Ștergi contul „{username}”?
            </h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Dispar contul, toate fișierele lui, ticketele și tot istoricul. Acțiunea e{" "}
              <span className="font-medium text-zinc-300">ireversibilă</span>.
            </p>

            <div className="mt-4">
              <label htmlFor="del-user-confirm" className="mb-1 block text-sm font-medium text-zinc-300">
                Scrie <span className="font-mono text-zinc-100">{username}</span> ca să confirmi
              </label>
              <Input variant="unstyled"
                id="del-user-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                placeholder={username}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-500/60 focus:bg-zinc-950 focus:ring-2 focus:ring-red-500/15"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="unstyled"
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
              >
                Anulează
              </Button>
              <Button variant="unstyled"
                type="button"
                onClick={remove}
                disabled={confirm !== username || pending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-zinc-50 transition hover:bg-red-500 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? "Se șterge…" : "Șterge definitiv"}
              </Button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </section>
  );
}
