"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2 } from "lucide-react";

// QR code for a share link, generated client-side (no server call). Rendered on
// a fixed white tile with dark modules so any scanner reads it regardless of the
// page theme, plus a "download PNG" button.
export function ShareQr({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then((d) => active && setDataUrl(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-white p-2 shadow-sm">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="Cod QR pentru link" className="h-full w-full" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        )}
      </div>
      {dataUrl && (
        <a
          href={dataUrl}
          download="ngig-share-qr.png"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
        >
          <Download className="h-3.5 w-3.5" />
          Descarcă QR (PNG)
        </a>
      )}
    </div>
  );
}
