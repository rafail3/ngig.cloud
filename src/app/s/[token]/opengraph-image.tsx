import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getShareSummary } from "@/server/share/service";
import { shareKindLabel } from "@/lib/share";
import { formatBytes } from "@/lib/format";

export const alt = "Fișier partajat prin ngig.cloud";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The card people actually see.

   A share link is almost always pasted into a chat, and what lands there is
   this image — for most recipients it is the first and only thing they see of
   the product before deciding whether the link is safe to open. So it names
   what is being shared, says how big it is, and carries the mark: enough to
   recognise a real link and to tell it apart from a phishing one.

   It never names a password-protected link's contents. The lock is the point:
   the sender chose that whoever holds the link still has to prove something,
   and an unfurled preview in a group chat would hand the filename to everyone
   in it. The generic card is the correct answer there, not a leak. */
export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Deliberately the side-effect-free lookup: an unfurler must not count as a
  // visit or bill a preview. See getShareSummary.
  const share = await getShareSummary(token);

  const mark = await readFile(join(process.cwd(), "public", "ngig-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  const locked = share?.hasPassword ?? false;
  const headline = !share
    ? "Link indisponibil"
    : locked
      ? "Fișier protejat cu parolă"
      : share.name;
  const kicker = !share
    ? "Linkul a expirat sau a fost revocat"
    : shareKindLabel(share.kind, share.itemCount).toUpperCase();
  const detail =
    share && !locked && share.size ? formatBytes(share.size) : null;

  /* The name is what the recipient reads to decide, so it is shown whole and
     the type steps down to make room. Sizes are chosen so the name stays on ONE
     line for as long as it can: a wrapped file name breaks mid-token — there is
     no space in `audi_rs6_custom_wrap_8k-7680x4320.jpg` to break at — and the
     first casualty is the extension, which is exactly the part that tells you
     what you are about to open.

     Capacity per size is the 1056px content box over an average advance of
     ~0.55em for this face. Past the smallest step a name has to wrap, and past
     two lines of it there is nothing left to gain, so it truncates. */
  const headlineSize =
    [72, 58, 46, 38, 32].find((s) => headline.length <= 1056 / (0.55 * s)) ?? 32;
  const shown = headline.length > 120 ? `${headline.slice(0, 119)}…` : headline;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#09090b",
          // The aurora from the share page itself, so the preview and the page
          // it opens are recognisably the same place. Applied as layers on the
          // container: Satori has no blur filter, and a rounded div with a
          // radial fill renders its own box edges instead of a soft glow.
          backgroundImage: [
            "radial-gradient(circle at 12% 8%, rgba(37,99,235,0.38) 0%, rgba(37,99,235,0) 55%)",
            "radial-gradient(circle at 88% 94%, rgba(14,165,233,0.28) 0%, rgba(14,165,233,0) 55%)",
          ].join(","),
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markSrc} width={72} height={72} alt="" />
          <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: "#fafafa" }}>ngig</span>
            <span style={{ color: "#60a5fa" }}>.cloud</span>
          </div>
        </div>

        {/* What is being shared */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 4,
              color: "#60a5fa",
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: headlineSize,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: -1.5,
              lineHeight: 1.2,
              // The content box, so wrapping has something to wrap against.
              maxWidth: 1056,
              // File names are mostly one unbroken token — `audi_rs6_custom_
              // wrap_8k-7680x4320.jpg` has no space to break at, so without
              // this it runs straight off the right edge instead of wrapping.
              wordBreak: "break-word",
            }}
          >
            {shown}
          </div>
          {detail && (
            <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa" }}>
              {detail}
            </div>
          )}
        </div>

        {/* Provenance line — the anti-phishing cue */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 26,
            color: "#71717a",
          }}
        >
          Distribuit în siguranță prin ngig.cloud
        </div>
      </div>
    ),
    size,
  );
}
