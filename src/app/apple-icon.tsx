import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CHROME_DARK } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/* The icon iOS uses when the site is added to the Home Screen.

   It exists separately from `icon.png` because iOS does not honour
   transparency here — it composites whatever it is given onto white and
   applies its own rounded mask. A bare transparent mark would come out as a
   pale cloud floating on a white tile. Painting the chrome behind it first
   gives the same dark tile as the app itself. */
export default async function AppleIcon() {
  const mark = await readFile(join(process.cwd(), "public", "ngig-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: CHROME_DARK,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markSrc} width={132} height={132} alt="" />
      </div>
    ),
    size,
  );
}
