import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "ngig.cloud — cloud privat, rapid și sigur";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The site's own card, for every page that does not generate its own.

   It shares the share-link card's world on purpose: same aurora, same mark,
   same provenance line. Someone who has seen a shared file from here should
   recognise the product when the domain itself is linked. Static — no data,
   so Next prerenders it once at build. */
export default async function Image() {
  const mark = await readFile(join(process.cwd(), "public", "ngig-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#09090b",
          // The aurora as layers on the container itself, not as positioned
          // circles: Satori has no blur filter, and a rounded div with a radial
          // fill renders its own box edges, which showed up as hard rectangles
          // and a seam across the middle.
          backgroundImage: [
            "radial-gradient(circle at 14% 10%, rgba(37,99,235,0.38) 0%, rgba(37,99,235,0) 55%)",
            "radial-gradient(circle at 86% 92%, rgba(14,165,233,0.28) 0%, rgba(14,165,233,0) 55%)",
          ].join(","),
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markSrc} width={132} height={132} alt="" />
          <div
            style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: -3 }}
          >
            <span style={{ color: "#fafafa" }}>ngig</span>
            <span style={{ color: "#60a5fa" }}>.cloud</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 34,
            color: "#a1a1aa",
            textAlign: "center",
            maxWidth: 820,
          }}
        >
          Cloudul tău privat — fișiere, foldere și partajări, rapid și sigur.
        </div>
      </div>
    ),
    size,
  );
}
