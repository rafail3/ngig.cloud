// Tiny IndexedDB store for in-flight uploads, so they survive a page refresh and
// can resume automatically. We persist the File blob itself (structured-clone
// supports File/Blob) plus the multipart key/uploadId needed to continue.

const DB_NAME = "ngig-uploads";
const STORE = "uploads";

export type StoredUpload = {
  id: string;
  name: string;
  size: number;
  type: string;
  file: Blob;
  folderId: string | null; // target folder (resolved at enqueue)
  // Set once the server hands back an upload plan; lets us resume.
  mode?: "single" | "multipart";
  key?: string;
  uploadId?: string;
  partSize?: number;
};

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function idbPut(rec: StoredUpload): Promise<void> {
  if (!hasIDB()) return;
  try {
    await tx("readwrite", (s) => s.put(rec));
  } catch {
    // persistence is best-effort; never block the upload on it
  }
}

// Merge a partial update (e.g. the plan) into an existing record.
export async function idbUpdate(
  id: string,
  patch: Partial<StoredUpload>,
): Promise<void> {
  if (!hasIDB()) return;
  try {
    const existing = await tx<StoredUpload | undefined>("readonly", (s) =>
      s.get(id),
    );
    if (!existing) return;
    await tx("readwrite", (s) => s.put({ ...existing, ...patch }));
  } catch {
    // ignore
  }
}

export async function idbDelete(id: string): Promise<void> {
  if (!hasIDB()) return;
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    // ignore
  }
}

export async function idbGetAll(): Promise<StoredUpload[]> {
  if (!hasIDB()) return [];
  try {
    const all = await tx<StoredUpload[]>("readonly", (s) => s.getAll());
    return all ?? [];
  } catch {
    return [];
  }
}
