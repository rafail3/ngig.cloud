"use client";

// Hands a PDF to the browser's print dialog. A blob URL is same-origin, so —
// unlike the Document Server's own iframe — we're allowed to reach into the
// frame and call print() on it.
export function printPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  document.body.appendChild(frame);
  // Clean up well after the print dialog has had time to open — tearing the
  // frame down early cancels the print.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    frame.remove();
  }, 60_000);
}
