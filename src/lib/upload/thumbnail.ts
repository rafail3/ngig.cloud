// Client-side thumbnail generation, run at upload time.
//
// The browser already holds the file it is about to upload, so a thumbnail costs
// one canvas draw and ~15KB of extra storage. The alternative — generating them
// on the server — would mean pulling every original back out of B2, i.e. paying
// egress (the thing the cost page measures) to render a list.
//
// Everything here is best-effort: any failure returns null and the file simply
// keeps its type icon. A thumbnail is never worth failing an upload over.

import { isTextEditable } from "@/lib/file-type";

// Longest edge of the generated image. Covers a 2x display at the ~40px the
// list renders, with room for a larger grid later.
const MAX_EDGE = 320;
const JPEG_QUALITY = 0.72;

// Text is rendered rather than photographed, so it gets its own settings: a
// page-shaped canvas (A4 ratio, like the PDF covers it sits beside in a grid)
// and a higher quality, because JPEG rings badly around small glyphs.
const TEXT_W = 226;
const TEXT_H = MAX_EDGE;
const TEXT_PAD = 12;
const TEXT_LINE_H = 15;
const TEXT_QUALITY = 0.85;
// Enough for the ~19 lines that fit. Read with a range request, so this is also
// all that comes down the wire for a 500MB log.
const TEXT_BYTES = 4096;

// Videos: how far in to seek for the poster frame. Far enough past a black or
// fade-in first frame to usually land on real content.
const VIDEO_SEEK_SEC = 1;
// Give up rather than hold the upload queue if decoding drags.
const VIDEO_TIMEOUT_MS = 5000;

export function canThumbnail(file: File): boolean {
  return isImage(file) || isVideo(file) || isPdf(file) || isText(file);
}

function isText(file: File): boolean {
  return isTextEditable(file.name, file.type);
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isImage(file: File): boolean {
  // SVG is excluded deliberately: rasterising untrusted SVG in a canvas runs the
  // document's own scripts/fetches in some engines. It renders fine as an <img>
  // in a sandboxed preview, but it is not worth the risk for a list icon.
  return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

function isVideo(file: File): boolean {
  return file.type.startsWith("video/");
}

// Fit within MAX_EDGE without upscaling — a small icon should stay small rather
// than be blown up and look soft.
function fit(w: number, h: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 };
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function draw(source: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  const size = fit(w, h);
  if (size.w === 0) return Promise.resolve(null);
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, size.w, size.h);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
  });
}

// Takes a Blob rather than a File so the same path serves both sources: the
// file the browser is uploading, and one fetched back out of B2 for a backfill.
async function fromImage(file: Blob): Promise<Blob | null> {
  // createImageBitmap decodes off the main thread where available, so a big
  // photo doesn't jank the UI while its upload starts.
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      return await draw(bitmap, bitmap.width, bitmap.height);
    } catch {
      return null;
    } finally {
      bitmap?.close();
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    return await draw(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fromVideo(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    return await fromVideoUrl(url, false);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The seek-and-draw itself, over any URL. For a remote one this is the cheap
// path: `preload="metadata"` plus a seek makes the browser issue RANGE requests,
// so a poster frame costs the header and a chunk — not the whole film.
async function fromVideoUrl(url: string, remote: boolean): Promise<Blob | null> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  // Without this a cross-origin frame TAINTS the canvas and toBlob throws. It
  // has to be set before src, and it means the fetch is a CORS one — B2 already
  // allows it (the same attribute is what VideoPlayer plays presigned URLs with).
  if (remote) video.crossOrigin = "anonymous";

  try {
    const frame = await new Promise<Blob | null>((resolve) => {
      const done = (b: Blob | null) => {
        clearTimeout(timeout);
        resolve(b);
      };
      const timeout = setTimeout(() => done(null), VIDEO_TIMEOUT_MS);

      video.onloadedmetadata = () => {
        // Clamp: seeking past the end of a very short clip never fires `seeked`.
        const target = Math.min(VIDEO_SEEK_SEC, Math.max(0, video.duration - 0.1));
        video.currentTime = Number.isFinite(target) ? target : 0;
      };
      video.onseeked = () => {
        void draw(video, video.videoWidth, video.videoHeight).then(done);
      };
      video.onerror = () => done(null); // codec the browser can't decode
      video.src = url;
    });
    return frame;
  } catch {
    return null;
  } finally {
    // Drop the source so the browser stops buffering the moment we have (or
    // gave up on) the frame — on a remote video that is the difference between
    // reading a chunk and reading the file. The caller owns the URL.
    video.removeAttribute("src");
    video.load();
  }
}

// pdf.js is a heavy import, so it loads only when a PDF is actually uploaded —
// and is cached after the first one. Same worker wiring as PdfViewer.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function fromPdf(file: File): Promise<Blob | null> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return renderFirstPage(pdfjs.getDocument({ data, isOffscreenCanvasSupported: true }));
}

// First page, rendered at whatever scale lands closest to MAX_EDGE. A document's
// cover is what makes it recognisable in a grid — far more than a red PDF icon.
async function renderFirstPage(
  task: ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>,
): Promise<Blob | null> {
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1, MAX_EDGE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Pages are transparent outside their content; without this the thumbnail
    // renders as black text on a black card.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
  } catch {
    return null;
  } finally {
    void task.destroy();
  }
}

// The first lines, drawn as a page. A wall of text is not readable at 40px, but
// its SHAPE is: indentation, line lengths and blank runs are what let someone
// pick their config file out of a grid of identical code icons.
function drawText(text: string): Promise<Blob | null> {
  const body = text.replace(/\t/g, "  ").split(/\r?\n/);
  if (!body.some((l) => l.trim().length > 0)) return Promise.resolve(null);

  const canvas = document.createElement("canvas");
  canvas.width = TEXT_W;
  canvas.height = TEXT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  // Paper, not the app's dark card: the thumbnail has to stay legible whichever
  // theme the list is in, and it sits next to PDF covers that are white anyway.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TEXT_W, TEXT_H);
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#3f3f46"; // zinc-700 — full black is harsh at this size

  const maxWidth = TEXT_W - TEXT_PAD * 2;
  const rows = Math.floor((TEXT_H - TEXT_PAD * 2) / TEXT_LINE_H);
  for (let i = 0; i < Math.min(rows, body.length); i++) {
    // Clip to the page instead of letting a long line run off it. The initial
    // slice keeps the measure loop short on minified files, where one "line"
    // can be the entire document.
    let line = body[i].slice(0, 200);
    while (line.length > 0 && ctx.measureText(line).width > maxWidth) {
      line = line.slice(0, -1);
    }
    ctx.fillText(line, TEXT_PAD, TEXT_PAD + i * TEXT_LINE_H);
  }

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", TEXT_QUALITY);
  });
}

// A JPEG thumbnail for the file, or null when one can't be made. Never throws.
export async function makeThumbnail(file: File): Promise<Blob | null> {
  try {
    if (isImage(file)) return await fromImage(file);
    if (isVideo(file)) return await fromVideo(file);
    if (isPdf(file)) return await fromPdf(file);
    if (isText(file)) return await drawText(await file.slice(0, TEXT_BYTES).text());
    return null;
  } catch {
    return null;
  }
}

// --- Backfill source: the original, read back out of B2 --------------------
//
// Same renderers, different input. A file uploaded before thumbnails shipped is
// no longer in the browser's hands, so the only way to make its preview is to
// read the original again — which is why only video and PDF are cheap here:
// both are consumed with range requests, so a poster frame or a cover page
// costs a slice of the object rather than all of it. An image has no such
// trick and comes down whole, which is why the server caps its size.

export type ThumbSourceKind = "image" | "video" | "pdf" | "text";

// Everything the browser needs to produce and store ONE thumbnail: where to read
// the original, how to render it, where to PUT the result. Lives here rather
// than in the service so both sides can name it without a client file importing
// a server-only module.
export type ThumbJob = {
  id: string;
  url: string;
  kind: ThumbSourceKind;
  uploadUrl: string;
  uploadKey: string;
};

// A JPEG thumbnail rendered from a remote original, or null. Never throws — a
// failure here just means the file keeps its type icon.
export async function makeThumbnailFromUrl(
  url: string,
  kind: ThumbSourceKind,
): Promise<Blob | null> {
  try {
    if (kind === "video") return await fromVideoUrl(url, true);
    if (kind === "text") {
      // Only the head of the file: a range request keeps a huge log as cheap as
      // a small one. A server that ignores Range answers 200 with the whole
      // body, which still renders — it just costs more.
      const res = await fetch(url, { headers: { Range: `bytes=0-${TEXT_BYTES - 1}` } });
      if (!res.ok) return null;
      return await drawText(await res.text());
    }
    if (kind === "pdf") {
      const pdfjs = await loadPdfjs();
      // `url` (not `data`): pdf.js then fetches ranges and stops once the first
      // page is rendered, instead of pulling a 200-page document to draw one.
      return await renderFirstPage(
        pdfjs.getDocument({ url, isOffscreenCanvasSupported: true }),
      );
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    return await fromImage(await res.blob());
  } catch {
    return null;
  }
}
