// Client-side upload engine with byte-level progress. Uses XMLHttpRequest (not
// fetch) because only XHR exposes upload progress events in browsers. Handles
// both the single-PUT and parallel-multipart plans returned by the server, and
// reports aggregate bytes sent so the UI can show %, speed and ETA.

import {
  createUploadAction,
  confirmUploadAction,
  completeUploadAction,
  abortUploadAction,
} from "@/app/drive-actions";

// Parts uploaded at once per file (matches the server-side part planning).
const PART_CONCURRENCY = 4;

export type UploadResult = { ok: boolean; revoked?: boolean; canceled?: boolean };

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

// Upload one file end-to-end. `onProgress` receives the total bytes sent so far.
export async function uploadFile(
  file: File,
  onProgress: (bytesSent: number) => void,
  signal: AbortSignal,
): Promise<UploadResult> {
  const contentType = file.type || "application/octet-stream";

  const plan = await createUploadAction({
    name: file.name,
    size: file.size,
    contentType,
  });
  if ("revoked" in plan) return { ok: false, revoked: true };

  try {
    if (plan.mode === "single") {
      await put(plan.url, file, onProgress, { "Content-Type": contentType }, signal);
    } else {
      // Track bytes per part and report their sum as overall progress.
      const partLoaded = new Array<number>(plan.partUrls.length).fill(0);
      const report = () =>
        onProgress(partLoaded.reduce((a, b) => a + b, 0));

      let next = 0;
      const worker = async () => {
        while (true) {
          const i = next++;
          if (i >= plan.partUrls.length) return;
          const start = i * plan.partSize;
          const blob = file.slice(start, Math.min(start + plan.partSize, file.size));
          await put(
            plan.partUrls[i],
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

      try {
        await Promise.all(
          Array.from(
            { length: Math.min(PART_CONCURRENCY, plan.partUrls.length) },
            worker,
          ),
        );
        const done = await completeUploadAction({
          key: plan.key,
          uploadId: plan.uploadId,
        });
        if (done && "revoked" in done) return { ok: false, revoked: true };
      } catch (e) {
        // Clean up the half-finished multipart upload.
        await abortUploadAction({ key: plan.key, uploadId: plan.uploadId });
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
