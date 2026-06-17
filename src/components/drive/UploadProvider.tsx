"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { startUpload, resumeUpload } from "@/lib/upload/uploader";
import { idbPut, idbUpdate, idbDelete, idbGetAll } from "@/lib/upload/store";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "done"
  | "error"
  | "canceled";

export type UploadJob = {
  id: string;
  name: string;
  size: number;
  sent: number;
  status: UploadStatus;
  speed: number; // bytes/sec (smoothed)
  etaSec: number | null;
  folderId: string | null; // which folder it lands in
  error?: string;
};

type InternalJob = UploadJob & {
  file: File;
  folderId: string | null;
  controller: AbortController;
  lastTime: number;
  lastBytes: number;
  // Present when the job is resuming a multipart upload after a refresh.
  resumeMeta?: {
    key: string;
    uploadId: string;
    size: number;
    folderId: string | null;
  };
};

// An item to upload: the file and the folder it lands in.
export type UploadItem = { file: File; folderId: string | null };

type UploadContextValue = {
  jobs: UploadJob[];
  enqueue: (items: UploadItem[]) => void;
  cancel: (id: string) => void;
  dismiss: (id: string) => void;
  clearFinished: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

// How many files upload at once (each file also uploads its parts in parallel).
const FILE_CONCURRENCY = 3;

// Finished cards auto-dismiss after this long unless the user closes them first.
const AUTO_DISMISS_MS = 10_000;

// Strip internal fields so the UI only sees the public job shape.
function toPublic(map: Map<string, InternalJob>): UploadJob[] {
  return Array.from(map.values()).map((j) => ({
    id: j.id,
    name: j.name,
    size: j.size,
    sent: j.sent,
    status: j.status,
    speed: j.speed,
    etaSec: j.etaSec,
    folderId: j.folderId,
    error: j.error,
  }));
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const jobsRef = useRef<Map<string, InternalJob>>(new Map());
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(0);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const hydratedRef = useRef(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  // Push the latest job state to React. (React Compiler handles memoization, so
  // these are plain functions — no manual useCallback, which would trip over the
  // mutual start/pump recursion.)
  function snapshot() {
    setJobs(toPublic(jobsRef.current));
  }

  // Re-render a few times a second while anything is uploading so the bars,
  // speed and ETA animate without flooding React with one render per progress
  // event.
  useEffect(() => {
    const id = setInterval(() => {
      let active = false;
      for (const j of jobsRef.current.values()) {
        if (j.status === "uploading") {
          active = true;
          break;
        }
      }
      if (active) setJobs(toPublic(jobsRef.current));
    }, 250);
    return () => clearInterval(id);
  }, []);

  // On mount, resume any uploads that a refresh/close interrupted.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void idbGetAll().then((recs) => {
      if (recs.length === 0) return;
      for (const rec of recs) {
        const file =
          rec.file instanceof File
            ? rec.file
            : new File([rec.file], rec.name, { type: rec.type });
        const resumeMeta =
          rec.mode === "multipart" && rec.key && rec.uploadId
            ? {
                key: rec.key,
                uploadId: rec.uploadId,
                size: rec.size,
                folderId: rec.folderId,
              }
            : undefined;
        jobsRef.current.set(rec.id, {
          id: rec.id,
          name: rec.name,
          size: rec.size,
          sent: 0,
          status: "queued",
          speed: 0,
          etaSec: null,
          file,
          folderId: rec.folderId,
          controller: new AbortController(),
          lastTime: 0,
          lastBytes: 0,
          resumeMeta,
        });
        queueRef.current.push(rec.id);
      }
      snapshot();
      pump();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove a finished card automatically after a short grace period.
  function scheduleAutoDismiss(id: string) {
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      timersRef.current.delete(id);
      jobsRef.current.delete(id);
      snapshot();
    }, AUTO_DISMISS_MS);
    timersRef.current.set(id, t);
  }

  function clearTimer(id: string) {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }

  function onProgress(job: InternalJob, bytes: number) {
    const now = Date.now();
    const dt = (now - job.lastTime) / 1000;
    if (dt >= 0.25) {
      const inst = (bytes - job.lastBytes) / dt;
      job.speed = job.speed ? job.speed * 0.7 + inst * 0.3 : inst;
      job.etaSec = job.speed > 0 ? (job.size - bytes) / job.speed : null;
      job.lastTime = now;
      job.lastBytes = bytes;
    }
    job.sent = bytes;
  }

  // Persist the server's plan so a refresh mid-upload can resume it.
  function persistPlan(id: string, meta: {
    mode: "single" | "multipart";
    key: string;
    uploadId?: string;
    partSize?: number;
  }) {
    void idbUpdate(id, {
      mode: meta.mode,
      key: meta.key,
      uploadId: meta.uploadId,
      partSize: meta.partSize,
    });
  }

  async function start(id: string) {
    const job = jobsRef.current.get(id);
    if (!job) return;
    runningRef.current += 1;
    job.status = "uploading";
    job.lastTime = Date.now();
    job.lastBytes = 0;
    snapshot();

    const report = (bytes: number) => onProgress(job, bytes);

    try {
      let res;
      if (job.resumeMeta) {
        try {
          res = await resumeUpload(job.file, job.resumeMeta, report, job.controller.signal);
        } catch {
          // The interrupted multipart upload is gone — start over from scratch.
          job.resumeMeta = undefined;
          res = await startUpload(job.file, job.folderId, report, job.controller.signal, (m) =>
            persistPlan(id, m),
          );
        }
      } else {
        res = await startUpload(job.file, job.folderId, report, job.controller.signal, (m) =>
          persistPlan(id, m),
        );
      }

      if (res.revoked) {
        window.location.assign("/login");
        return;
      }
      if (res.canceled) {
        job.status = "canceled";
      } else if (res.ok) {
        job.sent = job.size;
        job.etaSec = 0;
        job.status = "done";
        router.refresh(); // reflect the new file in the drive list
      }
    } catch (e) {
      job.status = "error";
      job.error = e instanceof Error ? e.message : "Eroare la upload.";
    } finally {
      void idbDelete(id); // upload is no longer in flight
      scheduleAutoDismiss(id);
      runningRef.current -= 1;
      snapshot();
      pump();
    }
  }

  // Start as many queued uploads as the concurrency budget allows.
  function pump() {
    while (runningRef.current < FILE_CONCURRENCY && queueRef.current.length > 0) {
      const id = queueRef.current.shift()!;
      void start(id);
    }
  }

  function enqueue(items: UploadItem[]) {
    for (const { file, folderId } of items) {
      const id = crypto.randomUUID();
      jobsRef.current.set(id, {
        id,
        name: file.name,
        size: file.size,
        sent: 0,
        status: "queued",
        speed: 0,
        etaSec: null,
        file,
        folderId,
        controller: new AbortController(),
        lastTime: 0,
        lastBytes: 0,
      });
      queueRef.current.push(id);
      // Persist so the upload can resume after a refresh.
      void idbPut({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        folderId,
      });
    }
    snapshot();
    pump();
  }

  function cancel(id: string) {
    const job = jobsRef.current.get(id);
    if (!job) return;
    if (job.status === "queued") {
      queueRef.current = queueRef.current.filter((q) => q !== id);
      job.status = "canceled";
      scheduleAutoDismiss(id);
    } else if (job.status === "uploading") {
      job.controller.abort(); // start() flips it to "canceled" and schedules dismiss
    }
    snapshot();
  }

  function dismiss(id: string) {
    clearTimer(id);
    jobsRef.current.delete(id);
    snapshot();
  }

  function clearFinished() {
    for (const [id, j] of jobsRef.current) {
      if (j.status === "done" || j.status === "canceled" || j.status === "error") {
        clearTimer(id);
        jobsRef.current.delete(id);
      }
    }
    snapshot();
  }

  return (
    <UploadContext.Provider
      value={{ jobs, enqueue, cancel, dismiss, clearFinished }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploads must be used within <UploadProvider>");
  return ctx;
}
