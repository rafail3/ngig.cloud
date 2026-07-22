import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listObjectsDetailed,
  deleteObject,
  abortStaleMultiparts,
} from "@/server/storage/b2";
import { notifyAdminsEvent } from "@/server/notifications/service";
import { formatBytes } from "@/lib/format";

// Daily orphan sweep for B2: removes objects that exist in the bucket but are
// referenced by NOTHING in the database. Deletion is guarded by several
// independent layers — each one alone would prevent real data from being
// touched:
//
//   1. DB is the source of truth, loaded fully (paginated); a failed or empty
//      read ABORTS the run — a DB hiccup must never look like "everything is
//      an orphan".
//   2. Age guard: only objects older than MIN_AGE_MS qualify — an in-flight
//      upload (presigned but not yet confirmed) is never touched.
//   3. Pattern guard: only keys matching the app's known layouts
//      (<uid>/<uuid> files, tickets/<uid>/… media) are ever deleted. Anything
//      with an unknown shape is left alone and only reported.
//   4. Circuit breaker: if the orphan share of the bucket looks implausibly
//      high, the run aborts and reports instead of deleting.
//   5. Per-key recheck: immediately before each delete the key is looked up
//      again in BOTH tables — a confirmUpload landing mid-run wins.
//   6. Run cap: at most MAX_DELETES per night; the rest waits for tomorrow.
//
// Separately, multipart uploads started but never finished (invisible as
// objects, but billed) are aborted after the same age window.

const MIN_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_DELETES = 500;
// Abort when orphan candidates exceed this share of the bucket (and are more
// than a handful) — that smells like a bug, not residue.
const MAX_ORPHAN_RATIO = 0.2;
const MIN_FOR_RATIO_CHECK = 10;

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
// Drive files: <ownerId>/<uuid>. Ticket media: tickets/<ownerId>/…
const KNOWN_PATTERNS = [
  new RegExp(`^${UUID}/${UUID}$`),
  new RegExp(`^tickets/${UUID}/`),
];

export type B2CleanupReport = {
  scanned: number;
  orphans: number;
  deleted: number;
  deletedBytes: number;
  abortedMultiparts: number;
  skippedUnknown: number;
  capped: boolean;
  abortedRun: string | null;
};

// Every value of `column` across the whole table, paginated (PostgREST caps a
// single select). Throws on any page error — the caller treats that as fatal.
async function allKeys(table: string, column: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const keys = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select(column)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const v = row[column];
      if (typeof v === "string" && v) keys.add(v);
    }
    if (!data || data.length < PAGE) break;
  }
  return keys;
}

// One targeted recheck right before deleting `key` — the last line of defense
// against a row that appeared while the sweep was running.
async function keyStillOrphan(key: string): Promise<boolean> {
  const admin = createAdminClient();
  const [f, t] = await Promise.all([
    admin.from("files").select("id").eq("storage_key", key).limit(1),
    admin.from("ticket_attachments").select("id").eq("storage_key", key).limit(1),
  ]);
  if (f.error || t.error) return false; // can't verify → don't delete
  return (f.data?.length ?? 0) === 0 && (t.data?.length ?? 0) === 0;
}

export async function cleanupOrphanB2Objects(): Promise<B2CleanupReport> {
  const report: B2CleanupReport = {
    scanned: 0,
    orphans: 0,
    deleted: 0,
    deletedBytes: 0,
    abortedMultiparts: 0,
    skippedUnknown: 0,
    capped: false,
    abortedRun: null,
  };

  // Layer 1: the DB truth. Any failure aborts the whole run.
  let fileKeys: Set<string>;
  let ticketKeys: Set<string>;
  try {
    [fileKeys, ticketKeys] = await Promise.all([
      allKeys("files", "storage_key"),
      allKeys("ticket_attachments", "storage_key"),
    ]);
  } catch (e) {
    report.abortedRun = `citirea DB a eșuat (${e instanceof Error ? e.message : "eroare"})`;
    return report;
  }

  const objects = await listObjectsDetailed("");
  report.scanned = objects.length;

  // Layer 1b: a bucket with objects but a DB with zero keys is a read gone
  // wrong (or a catastrophic wipe) — never a normal cleanup situation.
  if (objects.length > 0 && fileKeys.size === 0 && ticketKeys.size === 0) {
    report.abortedRun = "DB fără niciun key deși bucketul are obiecte";
    return report;
  }

  const now = Date.now();
  const candidates: { key: string; size: number }[] = [];
  for (const o of objects) {
    if (fileKeys.has(o.key) || ticketKeys.has(o.key)) continue; // referenced → keep
    const age = o.lastModified ? now - o.lastModified.getTime() : 0;
    if (age < MIN_AGE_MS) continue; // Layer 2: too fresh — may be in flight
    if (!KNOWN_PATTERNS.some((p) => p.test(o.key))) {
      report.skippedUnknown++; // Layer 3: unknown shape — report, never touch
      continue;
    }
    candidates.push({ key: o.key, size: o.size });
  }
  report.orphans = candidates.length;

  // Layer 4: implausibly many "orphans" = something else is wrong. Report only.
  if (
    candidates.length >= MIN_FOR_RATIO_CHECK &&
    candidates.length / Math.max(1, objects.length) > MAX_ORPHAN_RATIO
  ) {
    report.abortedRun = `prea mulți orfani dintr-o dată (${candidates.length}/${objects.length}) — verificare manuală`;
    return report;
  }

  // Layers 5 + 6: capped deletes, each re-verified right before removal.
  const batch = candidates.slice(0, MAX_DELETES);
  report.capped = candidates.length > batch.length;
  for (const c of batch) {
    if (!(await keyStillOrphan(c.key))) continue;
    try {
      await deleteObject(c.key);
      report.deleted++;
      report.deletedBytes += c.size;
    } catch {
      // one stubborn object must not stop the sweep
    }
  }

  // Unfinished multipart uploads past the same age window.
  try {
    report.abortedMultiparts = await abortStaleMultiparts(MIN_AGE_MS);
  } catch {
    // non-fatal
  }

  return report;
}

// Notify the admins — but only when the run actually found something worth
// knowing (deletions, aborted uploads, an aborted run, or unknown keys).
export async function reportB2Cleanup(r: B2CleanupReport): Promise<void> {
  const quiet =
    r.deleted === 0 && r.abortedMultiparts === 0 && !r.abortedRun && r.skippedUnknown === 0;
  if (quiet) return;

  const bits: string[] = [];
  if (r.abortedRun) bits.push(`Rulare oprită preventiv: ${r.abortedRun}.`);
  if (r.deleted > 0) {
    bits.push(`${r.deleted} obiecte orfane șterse (${formatBytes(r.deletedBytes)}).`);
  }
  if (r.capped) bits.push("Restul așteaptă rularea de mâine (limită per noapte).");
  if (r.abortedMultiparts > 0) {
    bits.push(`${r.abortedMultiparts} upload-uri neterminate anulate.`);
  }
  if (r.skippedUnknown > 0) {
    bits.push(`${r.skippedUnknown} chei cu format necunoscut — neatinse, de verificat manual.`);
  }

  await notifyAdminsEvent("b2_cleanup", { detalii: bits.join(" ") }, "/costs");
}
