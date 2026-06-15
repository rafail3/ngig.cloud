import "server-only";
import { createClient } from "@/lib/supabase/server";

// Sentinel thrown when the caller's session was revoked (blocked / signed out).
// Imperative server actions can't redirect() cleanly, so the action wrappers
// catch this and return a flag the client uses to navigate to /login.
export const SESSION_REVOKED = "SESSION_REVOKED";

export type ActiveUser = {
  id: string;
  maxFile: number | null;
  maxTotal: number | null;
};

type Gate = {
  blocked_until: string | null;
  max_file_size: number | null;
  max_total_size: number | null;
  session_active: boolean;
};

// Action-time guard. Beyond a valid token, it re-checks the user's CURRENT
// status via account_gate (block + session existence) and returns fresh
// per-user limits — one round-trip. If the user was blocked or signed out since
// login (both delete the session), it signs out and throws SESSION_REVOKED.
export async function requireActiveUser(): Promise<ActiveUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) throw new Error(SESSION_REVOKED);

  const { data: rows, error } = await supabase.rpc("account_gate");
  // Fail closed on a sensitive action: if the gate can't be evaluated (e.g. the
  // function isn't deployed), block the action instead of silently allowing it.
  if (error) throw new Error(`Verificare cont eșuată: ${error.message}`);
  const gate = (Array.isArray(rows) ? rows[0] : rows) as Gate | undefined;

  const blocked =
    !!gate?.blocked_until && new Date(gate.blocked_until).getTime() > Date.now();
  const signedOut = gate?.session_active === false;

  if (blocked || signedOut) {
    await supabase.auth.signOut();
    throw new Error(SESSION_REVOKED);
  }

  return {
    id,
    maxFile: gate?.max_file_size ?? null,
    maxTotal: gate?.max_total_size ?? null,
  };
}
