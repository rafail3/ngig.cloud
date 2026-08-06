"use client";

// Fills in thumbnails for files uploaded before thumbnails shipped.
//
// Those rows have `thumb_key = null` and show a type icon. The browser can still
// make the preview — it just has to read the original back out of B2 first. That
// read is the whole cost of this feature, so the work is lazy on purpose: only
// files the list is ACTUALLY RENDERING get processed. A folder nobody opens
// costs nothing.
//
// The shape of this is dictated by one fact: Next SERIALISES server actions.
// They queue behind one another on the client, so a per-file round trip would
// mean a folder of twenty waits sequentially before any pixel appears. Hence
// TWO actions per BATCH — one to fetch the jobs, one to persist the outcomes —
// with everything in between (read original, render, upload) going straight to
// B2, where requests really do run in parallel.
//
// Eligibility is decided by the SERVER (getThumbJobs): it owns the size cap and
// the egress accounting. The filter here is only a cheap pre-check so the
// obvious non-candidates — a .zip, a file that already has a thumbnail — don't
// take up a slot in the batch.

import { useEffect, useState } from "react";
import { getThumbJobsAction, saveThumbResultsAction } from "@/app/drive-actions";
import { makeThumbnailFromUrl, type ThumbJob } from "@/lib/upload/thumbnail";
import { extOf } from "@/lib/file-type";

export type BackfillCandidate = {
  id: string;
  name: string;
  mimeType: string | null;
  thumbKey?: string | null;
  thumbFailedAt?: string | null;
};

// One screenful per batch. Must not exceed the server's own cap.
const BATCH = 16;

// Renders in flight at once. Decoding is CPU work on the main thread, so this
// is about keeping the browser responsive, not about the network.
const CONCURRENCY = 4;

// Just long enough for the folder to paint first. A thumbnail is the least
// urgent thing on the page, but it shouldn't feel like an afterthought either.
const START_DELAY_MS = 150;

// If this many files in a row fail, something systemic is wrong (CORS dropped on
// the bucket, B2 unreachable) rather than a few odd files. Stop for the rest of
// the session instead of marking a whole drive as unrenderable.
const FAILURE_CIRCUIT = 5;

// --- Session state ----------------------------------------------------------
// Module-level, and deliberately so: the queue outlives the component. FileList
// unmounts on every folder change, and a per-component queue would mean
// cancelling work mid-flight on each navigation — and re-attempting the same
// files when the user walks back into a folder.

const queue: BackfillCandidate[] = [];
const attempted = new Set<string>();
const succeeded = new Set<string>();
const listeners = new Set<() => void>();
let draining = false;
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

// One file: read the original, render it, store the result. Returns the key on
// success, null when the file simply cannot produce an image, and throws when
// the failure is infrastructural (so the caller can leave it unmarked and let a
// later visit retry).
async function runJob(job: ThumbJob): Promise<string | null> {
  const blob = await makeThumbnailFromUrl(job.url, job.kind);
  // Nothing came back: a codec this browser can't decode, a corrupt file, an
  // encrypted PDF. THIS is what is worth remembering — the bytes were readable
  // and still produced no image.
  if (!blob) return null;

  const put = await fetch(job.uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  });
  // The thumbnail exists but couldn't be stored — infrastructure, not the file.
  if (!put.ok) throw new Error("thumb upload failed");
  return job.uploadKey;
}

async function drainBatch(batch: BackfillCandidate[]): Promise<void> {
  const jobs = await getThumbJobsAction(batch.map((c) => c.id));
  if ("revoked" in jobs) throw new Error("revoked");

  // Files the server left out are ineligible for good (too big, wrong type) —
  // nothing to record, and nothing to ask about again.
  const results: { id: string; thumbKey: string | null }[] = [];
  const pending = [...jobs];

  const worker = async () => {
    for (let job = pending.shift(); job; job = pending.shift()) {
      try {
        const key = await runJob(job);
        results.push({ id: job.id, thumbKey: key });
        if (key) {
          consecutiveFailures = 0;
          succeeded.add(job.id);
          // Paint it now. The row is already on screen, and waiting for the
          // batch to finish would hold back thumbnails that are ready.
          for (const notify of listeners) notify();
        } else {
          consecutiveFailures++;
        }
      } catch {
        // Retryable: forget the attempt so a later visit picks it up.
        consecutiveFailures++;
        attempted.delete(job.id);
      }
      if (consecutiveFailures >= FAILURE_CIRCUIT) {
        circuitOpen = true;
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // One write for the whole batch. Display never waited on it.
  if (results.length > 0) await saveThumbResultsAction(results);
}

// Idempotent: safe to call at any time. Does nothing when the queue is empty or
// a drain is already running.
function drain(): void {
  if (draining || circuitOpen || queue.length === 0) return;
  draining = true;
  void (async () => {
    try {
      while (!circuitOpen && queue.length > 0) {
        await drainBatch(queue.splice(0, BATCH));
      }
    } catch {
      // A batch-level failure (session revoked, action threw) stops this run;
      // the next render re-queues whatever never got attempted.
      for (const c of queue.splice(0)) attempted.delete(c.id);
    } finally {
      draining = false;
    }
  })();
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
    // Scheduled rather than immediate, and unconditionally — a drain call with
    // an empty queue is a no-op, and this way no enqueue is left unpumped.
    const timer = setTimeout(drain, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [files]);

  return succeeded;
}
