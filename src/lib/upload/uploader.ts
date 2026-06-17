// Client-side upload engine with byte-level progress. Uses XMLHttpRequest (not
// fetch) because only XHR exposes upload progress events in browsers. Handles
// the single-PUT and parallel-multipart plans, and supports RESUMING a multipart
// upload after a refresh (re-uploading only the parts B2 doesn't already have).

import {
  createUploadAction,
  confirmUploadAction,
  completeUploadAction,
  abortUploadAction,
  resumeUploadAction,
} from "@/app/drive-actions";

// Parts uploaded at once per file.
const PART_CONCURRENCY = 4;

export type UploadResult = { ok: boolean; revoked?: boolean; canceled?: boolean };

// Plan metadata surfaced to the caller so it can be persisted for resuming.
export type PlanMeta = {
  mode: "single" | "multipart";
  key: string;
  uploadId?: string;
  partSize?: number;
};

// PUT a body to a presigned URL, reporting uploaded bytes via onLoaded.
function put(
  url: string,
  body: Blob,
  onLoaded: (loaded: number) => void,
  headers: Record<string, string> | undefined,
  signal: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Upload eșuat."));
    xhr.onerror = () => reject(new Error("Upload eșuat."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    if (signal.aborted) {
      xhr.abort();
      return;
    }
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

// Upload a file's parts in parallel, skipping the ones already on B2 (doneSet,
// 0-based indexes). Reports the running total of bytes sent including done parts.
async function runParts(
  file: File,
  partUrls: string[],
  partSize: number,
  onProgress: (bytesSent: number) => void,
  signal: AbortSignal,
  doneSet: Set<number>,
): Promise<void> {
  const partLoaded = new Array<number>(partUrls.length).fill(0);
  // Count already-uploaded parts as fully done for progress.
  for (const i of doneSet) {
    partLoaded[i] = Math.min(partSize, file.size - i * partSize);
  }
  const report = () => onProgress(partLoaded.reduce((a, b) => a + b, 0));
  report();

  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= partUrls.length) return;
      if (doneSet.has(i)) continue;
      const start = i * partSize;
      const blob = file.slice(start, Math.min(start + partSize, file.size));
      await put(
        partUrls[i],
        blob,
        (loaded) => {
          partLoaded[i] = loaded;
          report();
        },
        undefined,
        signal,
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PART_CONCURRENCY, partUrls.length) }, worker),
  );
}

// Fresh upload. `onPlan` fires once the server returns a plan, so the caller can
// persist the key/uploadId for resuming.
export async function startUpload(
  file: File,
  onProgress: (bytesSent: number) => void,
  signal: AbortSignal,
  onPlan: (meta: PlanMeta) => void,
): Promise<UploadResult> {
  const contentType = file.type || "application/octet-stream";

  const plan = await createUploadAction({
    name: file.name,
    size: file.size,
    contentType,
  });
  if ("revoked" in plan) return { ok: false, revoked: true };

  onPlan(
    plan.mode === "multipart"
      ? {
          mode: "multipart",
          key: plan.key,
          uploadId: plan.uploadId,
          partSize: plan.partSize,
        }
      : { mode: "single", key: plan.key },
  );

  try {
    if (plan.mode === "single") {
      await put(plan.url, file, onProgress, { "Content-Type": contentType }, signal);
    } else {
      try {
        await runParts(file, plan.partUrls, plan.partSize, onProgress, signal, new Set());
        const done = await completeUploadAction({
          key: plan.key,
          uploadId: plan.uploadId,
        });
        if (done && "revoked" in done) return { ok: false, revoked: true };
      } catch (e) {
        if (!isAbort(e)) {
          await abortUploadAction({ key: plan.key, uploadId: plan.uploadId });
        }
        throw e;
      }
    }
  } catch (e) {
    if (isAbort(e)) return { ok: false, canceled: true };
    throw e;
  }

  const confirmed = await confirmUploadAction({
    name: file.name,
    size: file.size,
    contentType,
    key: plan.key,
  });
  if (confirmed && "revoked" in confirmed) return { ok: false, revoked: true };

  return { ok: true };
}

// Resume an interrupted multipart upload: re-presign parts, skip the ones B2
// already has, upload the rest, then complete. Throws if the multipart upload no
// longer exists on B2 (the caller then restarts fresh).
export async function resumeUpload(
  file: File,
  meta: { key: string; uploadId: string; size: number },
  onProgress: (bytesSent: number) => void,
  signal: AbortSignal,
): Promise<UploadResult> {
  const contentType = file.type || "application/octet-stream";

  const res = await resumeUploadAction({
    key: meta.key,
    uploadId: meta.uploadId,
    size: meta.size,
  });
  if ("revoked" in res) return { ok: false, revoked: true };

  const doneSet = new Set<number>(res.doneParts.map((n) => n - 1)); // → 0-based

  try {
    try {
      await runParts(file, res.partUrls, res.partSize, onProgress, signal, doneSet);
      const done = await completeUploadAction({
        key: meta.key,
        uploadId: meta.uploadId,
      });
      if (done && "revoked" in done) return { ok: false, revoked: true };
    } catch (e) {
      if (!isAbort(e)) {
        await abortUploadAction({ key: meta.key, uploadId: meta.uploadId });
      }
      throw e;
    }
  } catch (e) {
    if (isAbort(e)) return { ok: false, canceled: true };
    throw e;
  }

  const confirmed = await confirmUploadAction({
    name: file.name,
    size: file.size,
    contentType,
    key: meta.key,
  });
  if (confirmed && "revoked" in confirmed) return { ok: false, revoked: true };

  return { ok: true };
}
