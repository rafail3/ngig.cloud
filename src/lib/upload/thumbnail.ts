// Client-side thumbnail generation, run at upload time.
//
// The browser already holds the file it is about to upload, so a thumbnail costs
// one canvas draw and ~15KB of extra storage. The alternative — generating them
// on the server — would mean pulling every original back out of B2, i.e. paying
// egress (the thing the cost page measures) to render a list.
//
// Everything here is best-effort: any failure returns null and the file simply
// keeps its type icon. A thumbnail is never worth failing an upload over.

// Longest edge of the generated image. Covers a 2x display at the ~40px the
// list renders, with room for a larger grid later.
const MAX_EDGE = 320;
const JPEG_QUALITY = 0.72;

// Videos: how far in to seek for the poster frame. Far enough past a black or
// fade-in first frame to usually land on real content.
const VIDEO_SEEK_SEC = 1;
// Give up rather than hold the upload queue if decoding drags.
const VIDEO_TIMEOUT_MS = 5000;

export function canThumbnail(file: File): boolean {
  return isImage(file) || isVideo(file);
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

async function fromImage(file: File): Promise<Blob | null> {
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
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

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
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

// A JPEG thumbnail for the file, or null when one can't be made. Never throws.
export async function makeThumbnail(file: File): Promise<Blob | null> {
  try {
    if (isImage(file)) return await fromImage(file);
    if (isVideo(file)) return await fromVideo(file);
    return null;
  } catch {
    return null;
  }
}
