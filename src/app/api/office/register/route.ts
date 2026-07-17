import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getOfficeUrlMode, setOfficeServerUrl } from "@/server/office/onlyoffice";

// Where the Document Server announces its own address.
//
// It may live behind a tunnel that hands out a new URL every time the host
// reboots. Rather than an admin chasing that by hand, the host POSTs its current
// address here on startup and the app picks it up live — no redeploy, no clicks.
//
// There's no user session here (the caller is a machine), so the only authority
// is a shared secret. Without OFFICE_REGISTER_SECRET set, the endpoint is off.

function authorized(request: Request): boolean {
  const secret = process.env.OFFICE_REGISTER_SECRET ?? "";
  if (!secret) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  // Compare in constant time; lengths must match first or timingSafeEqual throws.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let url: unknown;
  try {
    ({ url } = (await request.json()) as { url?: unknown });
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (typeof url !== "string" || !/^https:\/\/[^\s/]+/i.test(url)) {
    // HTTPS only: the app is HTTPS, and a browser refuses to load the editor's
    // script over plain HTTP anyway.
    return NextResponse.json({ error: "url must be https" }, { status: 400 });
  }

  // An admin can pin the address by hand; a host announcing itself must not be
  // able to steal it back. Answer 200 so the caller knows it was heard, not
  // broken — it simply isn't in charge right now.
  if ((await getOfficeUrlMode()) === "manual") {
    return NextResponse.json({ ok: false, ignored: "manual mode" });
  }

  await setOfficeServerUrl(url);
  return NextResponse.json({ ok: true, url: url.replace(/\/$/, "") });
}
