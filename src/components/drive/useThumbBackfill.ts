"use client";

// Fills in thumbnails for files uploaded before thumbnails shipped.
//
// Those rows have `thumb_key = null` and show a type icon. The browser can still
// make the preview — it just has to read the original back out of B2 first. That
// read is the whole cost of this feature, so the work is lazy on purpose: only
// files the list is ACTUALLY RENDERING get processed, two at a time, and each one
// is attempted once. A folder nobody opens costs nothing.
//
// Eligibility is decided by the SERVER (getThumbSource): it owns the size cap
// and the egress accounting. The filter here is only a cheap pre-check so the
// obvious non-candidates — a .zip, a file that already has a thumbnail — don't
// cost a round trip.

import { useEffect, useState } from "react";
import {
  getThumbSourceAction,
  createThumbUploadAction,
  setFileThumbAction,
  markThumbFailedAction,
} from "@/app/drive-actions";
import { makeThumbnailFromUrl } from "@/lib/upload/thumbnail";
import { extOf } from "@/lib/file-type";

export type BackfillCandidate = {
  id: string;
  name: string;
  mimeType: string | null;
  thumbKey?: string | null;
  thumbFailedAt?: string | null;
};

// Two at a time: enough to fill a screen quickly, few enough that the folder's
// own requests (and any upload in flight) still get the network.
const CONCURRENCY = 2;

// Let the folder finish painting first. A thumbnail is the least urgent thing on
// the page — it must never compete with the content the user asked for.
const START_DELAY_MS = 600;

// If this many attempts fail back to back, something systemic is wrong (CORS
// dropped on the bucket, B2 unreachable) rather than a few odd files. Stop for
// the rest of the session instead of marking a whole drive as unrenderable.
const FAILURE_CIRCUIT = 5;

// --- Session state ----------------------------------------------------------
// All of this is module-level, and deliberately so: the queue outlives the
// component. FileList unmounts on every folder change, and a per-component
// queue would mean cancelling work mid-flight on each navigation — and
// re-attempting the same files when the user walks back into a folder.

const queue: BackfillCandidate[] = [];
const attempted = new Set<string>();
const succeeded = new Set<string>();
const listeners = new Set<() => void>();
let active = 0;
let consecutiveFailures = 0;
let circuitOpen = false;

// Mirrors the server's kind detection, minus the size rules it enforces itself.
function eligible(f: BackfillCandidate): boolean {
  if (f.thumbKey || f.thumbFailedAt) return false;
  const m = f.mimeType ?? "";
  const ext = extOf(f.name) ?? "";
  if (m === "image/svg+xml" || ext === "svg") return false; // never rasterised
  return (
    m.startsWith("image/") ||
    m.startsWith("video/") ||
    m === "application/pdf" ||
    ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "mp4", "webm", "mov", "m4v", "pdf"].includes(
      ext,
    )
  );
}

type Outcome = "ok" | "unrenderable" | "retry";

async function backfillOne(f: BackfillCandidate): Promise<Outcome> {
  const src = await getThumbSourceAction(f.id);
  // null = the server says this file isn't eligible (too big, wrong type,
  // already handled). Not a failure, and not worth asking about again.
  if (!src) return "unrenderable";
  if ("revoked" in src) return "retry";

  const blob = await makeThumbnailFromUrl(src.url, src.kind);
  // Nothing came back: a codec this browser can't decode, a corrupt file, an
  // encrypted PDF. THIS is the case worth remembering in the database — the
  // bytes were readable and still produced no image.
  if (!blob) return "unrenderable";

  const plan = await createThumbUploadAction({ size: blob.size });
  if ("revoked" in plan) return "retry";

  const put = await fetch(plan.url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  });
  // The thumbnail exists but couldn't be stored — infrastructure, not the file.
  // Left unmarked so a later visit tries again.
  if (!put.ok) return "retry";

  await setFileThumbAction({ id: f.id, thumbKey: plan.key });
  return "ok";
}

// Idempotent: safe to call at any time, from anywhere. Starts as many workers as
// the concurrency cap allows and does nothing when the queue is empty.
function pump(): void {
  while (!circuitOpen && active < CONCURRENCY && queue.length > 0) {
    const item = queue.shift()!;
    active++;
    void (async () => {
      try {
        const outcome = await backfillOne(item);
        if (outcome === "ok") {
          consecutiveFailures = 0;
          succeeded.add(item.id);
          for (const notify of listeners) notify();
        } else if (outcome === "unrenderable") {
          consecutiveFailures++;
          await markThumbFailedAction(item.id);
        } else {
          // Retryable: forget the attempt so a later visit picks it up.
          consecutiveFailures++;
          attempted.delete(item.id);
        }
      } catch {
        // A thrown action (network, session) is retryable by the same rule.
        consecutiveFailures++;
        attempted.delete(item.id);
      } finally {
        if (consecutiveFailures >= FAILURE_CIRCUIT) circuitOpen = true;
        active--;
        pump();
      }
    })();
  }
}

/**
 * Generates the missing thumbnails for the files currently on screen.
 * Returns the ids that got one in this session, so the list can swap the type
 * icon for the real image without waiting for a refetch.
 */
export function useThumbBackfill(files: BackfillCandidate[]): Set<string> {
  const [, bump] = useState(0);

  // Re-render this list when any job finishes, wherever it was queued from.
  useEffect(() => {
    const notify = () => bump((n) => n + 1);
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }, []);

  useEffect(() => {
    if (circuitOpen) return;
    for (const f of files) {
      if (attempted.has(f.id) || !eligible(f)) continue;
      attempted.add(f.id);
      queue.push(f);
    }
    // Scheduled rather than immediate, and unconditionally — a pump call with an
    // empty queue is a no-op, and this way no enqueue can end up unpumped.
    const timer = setTimeout(pump, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [files]);

  return succeeded;
}
