import "server-only";
import { Resend } from "resend";
import { dashboardOrigin } from "@/lib/dashboard";

// FROM must be on a Resend-verified domain (ngig.cloud). INVITE_REQUEST_TO is
// the inbox that receives invite requests (the owner's Gmail).
const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM ?? "ngig.cloud <noreply@ngig.cloud>";
const INVITE_TO = process.env.INVITE_REQUEST_TO ?? "ngigcloud@gmail.com";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Link to the dashboard invite generator with the requester's email prefilled.
function dashboardInviteUrl(email: string): string {
  return `${dashboardOrigin()}/invites?email=${encodeURIComponent(email)}`;
}

// Shared email shell — branded card, works in Gmail/Outlook (inline styles).
function shell(title: string, inner: string): string {
  return `
  <div style="margin:0;padding:24px;background:#0a0a0b;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden">
      <div style="padding:24px 28px;border-bottom:1px solid #27272a">
        <img src="https://ngig.cloud/ngig-mark.png" alt="" width="34" height="34" style="vertical-align:middle;border-radius:8px" />
        <span style="margin-left:10px;font-size:20px;font-weight:800;color:#fafafa;vertical-align:middle">ngig<span style="color:#818cf8">.cloud</span></span>
      </div>
      <div style="padding:24px 28px">
        <h1 style="margin:0 0 16px;font-size:18px;color:#fafafa">${title}</h1>
        ${inner}
      </div>
      <div style="padding:16px 28px;border-top:1px solid #27272a;color:#71717a;font-size:12px">
        ngig.cloud — cloud personal, pe invitație.
      </div>
    </div>
  </div>`;
}

function row(label: string, value: string): string {
  return `<p style="margin:0 0 10px;color:#a1a1aa;font-size:14px">
    <strong style="color:#fafafa">${label}:</strong> ${value}</p>`;
}

function button(href: string, text: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600">${text}</a>`;
}

export async function sendInviteRequest(input: {
  name: string;
  email: string;
  message: string;
  ip?: string | null;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const ipLine = input.ip && input.ip !== "::1" && input.ip !== "127.0.0.1"
    ? row("IP", escapeHtml(input.ip))
    : "";

  const inner = `
    ${row("Nume", escapeHtml(input.name))}
    ${row("Email", escapeHtml(input.email))}
    ${ipLine}
    <p style="margin:16px 0 4px;color:#fafafa;font-size:14px;font-weight:600">Mesaj</p>
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:14px;white-space:pre-wrap">${escapeHtml(input.message) || "(fără mesaj)"}</p>
    ${button(dashboardInviteUrl(input.email), "Generează cod pentru el")}
    <p style="margin:12px 0 0;color:#71717a;font-size:12px">Butonul deschide dashboard-ul cu emailul completat. De acolo poți genera codul și i-l trimiți direct pe email.</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: INVITE_TO,
    replyTo: input.email,
    subject: `Cerere invitație — ${input.name}`,
    text: [
      `Nume: ${input.name}`,
      `Email: ${input.email}`,
      input.ip ? `IP: ${input.ip}` : "",
      "",
      "Mesaj:",
      input.message || "(fără mesaj)",
      "",
      `Generează cod: ${dashboardInviteUrl(input.email)}`,
    ].filter(Boolean).join("\n"),
    html: shell("Cerere invitație nouă", inner),
  });

  if (error) throw new Error("Nu am putut trimite cererea. Reîncearcă.");
}

// Styled approval email sent TO the requester via Resend (verified domain →
// good deliverability + branded). Replaces the plain mailto approach.
export async function sendInviteCode(input: {
  email: string;
  code: string;
  name?: string | null;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const greeting = input.name ? `Salut ${escapeHtml(input.name)},` : "Salut,";
  // The register link carries the code, so the registration form pre-fills it —
  // the recipient never has to copy/paste it by hand.
  const registerUrl = `https://ngig.cloud/register?code=${encodeURIComponent(input.code)}`;
  const inner = `
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      ${greeting}<br/>Cererea ta de invitație pe ngig.cloud a fost aprobată.
    </p>
    <p style="margin:0 0 8px;color:#fafafa;font-size:14px;font-weight:600">Codul tău de invitație</p>
    <div style="margin:0 0 20px;padding:14px 16px;background:#0a0a0b;border:1px solid #27272a;border-radius:12px;font-family:monospace;font-size:16px;color:#a5b4fc;word-break:break-all">${escapeHtml(input.code)}</div>
    ${button(registerUrl, "Creează-ți contul")}
    <p style="margin:16px 0 0;color:#71717a;font-size:12px">Butonul deschide pagina de înregistrare cu codul deja completat.</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: "Invitația ta pe ngig.cloud",
    text: [
      greeting.replace(/<[^>]+>/g, ""),
      "Cererea ta de invitație pe ngig.cloud a fost aprobată.",
      "",
      `Cod de invitație: ${input.code}`,
      "",
      `Creează-ți contul (cod precompletat): ${registerUrl}`,
      "",
      "— ngig.cloud",
    ].join("\n"),
    html: shell("Invitație ngig.cloud", inner),
  });

  if (error) throw new Error("Nu am putut trimite codul. Reîncearcă.");
}

// Auto-acknowledgement sent TO the requester right after they submit the invite
// request form, so they know it was received (the owner gets a separate
// notification). Best-effort — its failure must not fail the request.
export async function sendInviteRequestAck(input: {
  name: string;
  email: string;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const greeting = input.name ? `Salut ${escapeHtml(input.name)},` : "Salut,";
  const inner = `
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      ${greeting}<br/>Am primit cererea ta de invitație pe ngig.cloud. Mulțumim!
    </p>
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      O analizăm și revenim cu un răspuns pe această adresă de email. Dacă e
      aprobată, vei primi un cod de invitație cu care îți poți crea contul.
    </p>
    <p style="margin:0;color:#71717a;font-size:12px">Nu e nevoie să faci nimic acum.</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: "Am primit cererea ta — ngig.cloud",
    text: [
      greeting.replace(/<[^>]+>/g, ""),
      "Am primit cererea ta de invitație pe ngig.cloud. Mulțumim!",
      "",
      "O analizăm și revenim cu un răspuns pe această adresă. Dacă e aprobată, vei primi un cod de invitație.",
      "",
      "— ngig.cloud",
    ].join("\n"),
    html: shell("Cerere primită", inner),
  });

  if (error) throw new Error("Nu am putut trimite confirmarea.");
}
