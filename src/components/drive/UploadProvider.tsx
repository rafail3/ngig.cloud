"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { uploadFile } from "@/lib/upload/uploader";

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
  error?: string;
};

type InternalJob = UploadJob & {
  file: File;
  controller: AbortController;
  lastTime: number;
  lastBytes: number;
};

type UploadContextValue = {
  jobs: UploadJob[];
  enqueue: (files: File[]) => void;
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
    error: j.error,
  }));
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const jobsRef = useRef<Map<string, InternalJob>>(new Map());
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(0);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
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

  async function start(id: string) {
    const job = jobsRef.current.get(id);
    if (!job) return;
    runningRef.current += 1;
    job.status = "uploading";
    job.lastTime = Date.now();
    job.lastBytes = 0;
    snapshot();

    try {
      const res = await uploadFile(
        job.file,
        (bytes) => onProgress(job, bytes),
        job.controller.signal,
      );
      if (res.revoked) {
        window.location.assign("/login");
        return;
      }
      if (res.canceled) {
        job.status = "canceled";
        scheduleAutoDismiss(id);
      } else if (res.ok) {
        job.sent = job.size;
        job.etaSec = 0;
        job.status = "done";
        scheduleAutoDismiss(id);
        router.refresh(); // reflect the new file in the drive list
      }
    } catch (e) {
      job.status = "error";
      job.error = e instanceof Error ? e.message : "Eroare la upload.";
      scheduleAutoDismiss(id);
    } finally {
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

  function enqueue(files: File[]) {
    for (const file of files) {
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
        controller: new AbortController(),
        lastTime: 0,
        lastBytes: 0,
      });
      queueRef.current.push(id);
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
