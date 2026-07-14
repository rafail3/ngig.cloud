import "server-only";
import { Resend } from "resend";
import { appOrigin, dashboardOrigin } from "@/lib/dashboard";

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
// The outer wrapper is transparent (no dark backdrop): the rounded card floats
// on the client's own background, so there's no hard black rectangle bleeding
// to the edge on a white inbox. (True gradient fades aren't reliable in Gmail.)
function shell(title: string, inner: string): string {
  return `
  <div style="margin:0;padding:24px;background:transparent;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden">
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

// Sent TO the requester when the admin rejects their invite request.
// Best-effort — its failure must not fail the reject action.
export async function sendInviteRejected(input: {
  name: string;
  email: string;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const greeting = input.name ? `Salut ${escapeHtml(input.name)},` : "Salut,";
  const inner = `
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      ${greeting}<br/>Îți mulțumim pentru interesul față de ngig.cloud.
    </p>
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      De data aceasta nu putem aproba cererea ta de invitație. Poți încerca din
      nou mai târziu.
    </p>
    <p style="margin:0;color:#71717a;font-size:12px">— ngig.cloud</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: "Cererea ta de invitație nu a putut fi aprobată — ngig.cloud",
    text: [
      greeting.replace(/<[^>]+>/g, ""),
      "Îți mulțumim pentru interesul față de ngig.cloud.",
      "",
      "De data aceasta nu putem aproba cererea ta de invitație. Poți încerca din nou mai târziu.",
      "",
      "— ngig.cloud",
    ].join("\n"),
    html: shell("Cerere de invitație", inner),
  });

  if (error) throw new Error("Nu am putut trimite răspunsul.");
}

// Security notice sent to the OLD address when the account email is changed.
export async function sendEmailChangedNotice(input: {
  oldEmail: string;
  newEmail: string;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const inner = `
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      Salut,<br/>Emailul contului tău ngig.cloud a fost schimbat în
      <strong style="color:#fafafa">${escapeHtml(input.newEmail)}</strong>.
    </p>
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      Dacă tu ai făcut schimbarea, nu trebuie să faci nimic. Dacă <strong style="color:#fafafa">nu</strong> ai fost tu, schimbă-ți imediat parola.
    </p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: input.oldEmail,
    subject: "Emailul contului tău a fost schimbat — ngig.cloud",
    text: [
      "Salut,",
      `Emailul contului tău ngig.cloud a fost schimbat în ${input.newEmail}.`,
      "",
      "Dacă nu ai fost tu, schimbă-ți imediat parola.",
      "",
      "— ngig.cloud",
    ].join("\n"),
    html: shell("Email schimbat", inner),
  });

  if (error) throw new Error("Nu am putut trimite notificarea.");
}

// Activation email sent to the NEW address — clicking the button confirms it.
export async function sendEmailActivation(input: {
  email: string;
  token: string;
  origin: string;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const url = `${input.origin}/confirm-email?token=${encodeURIComponent(input.token)}`;
  const inner = `
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      Salut,<br/>Ai setat această adresă ca email al contului tău ngig.cloud.
      Confirmă că îți aparține apăsând butonul de mai jos.
    </p>
    ${button(url, "Activează emailul")}
    <p style="margin:16px 0 0;color:#71717a;font-size:12px">Dacă nu tu ai cerut schimbarea, ignoră acest mesaj.</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: "Confirmă-ți noul email — ngig.cloud",
    text: [
      "Salut,",
      "Ai setat această adresă ca email al contului tău ngig.cloud.",
      "",
      `Activează emailul: ${url}`,
      "",
      "— ngig.cloud",
    ].join("\n"),
    html: shell("Confirmă-ți emailul", inner),
  });

  if (error) throw new Error("Nu am putut trimite emailul de activare.");
}

// Category labels for the emails (mirror TICKET_CATEGORIES on the app side).
const TICKET_CATEGORY_LABEL: Record<string, string> = {
  account: "Cont și autentificare",
  storage: "Stocare și fișiere",
  sharing: "Partajare și linkuri",
  billing: "Facturare și abonament",
  performance: "Performanță și erori",
  security: "Securitate și confidențialitate",
  feature: "Cerere funcționalitate",
  bug: "Raportare bug",
  feedback: "Feedback și sugestii",
  other: "Altele",
};

function ticketCategoryLabel(category: string): string {
  return TICKET_CATEGORY_LABEL[category] ?? category;
}

// Confirmation sent TO the user right after they open a support ticket.
// Best-effort — its failure must not fail ticket creation.
export async function sendTicketOpenedUser(input: {
  email: string;
  subject: string;
  category: string;
  ticketId: string;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const url = `${appOrigin()}/support/${input.ticketId}`;
  const inner = `
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      Salut,<br/>Am primit ticketul tău de suport. Îți răspundem cât putem de repede.
    </p>
    ${row("Subiect", escapeHtml(input.subject))}
    ${row("Categorie", escapeHtml(ticketCategoryLabel(input.category)))}
    <p style="margin:16px 0 0"></p>
    ${button(url, "Vezi ticketul")}
    <p style="margin:16px 0 0;color:#71717a;font-size:12px">Vei primi o notificare când îți răspundem.</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: `Ticket deschis: ${input.subject} — ngig.cloud`,
    text: [
      "Salut,",
      "Am primit ticketul tău de suport. Îți răspundem cât putem de repede.",
      "",
      `Subiect: ${input.subject}`,
      `Categorie: ${ticketCategoryLabel(input.category)}`,
      "",
      `Vezi ticketul: ${url}`,
      "",
      "— ngig.cloud",
    ].join("\n"),
    html: shell("Ticket deschis", inner),
  });

  if (error) throw new Error("Nu am putut trimite confirmarea.");
}

// Alert sent TO the support inbox (the owner) when a new ticket is opened.
export async function sendTicketOpenedAdmin(input: {
  username: string;
  subject: string;
  category: string;
  priority: string;
  message: string;
  ticketId: string;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const priorityLabel =
    input.priority === "high" ? "Mare" : input.priority === "low" ? "Scăzută" : "Medie";
  const url = `${dashboardOrigin()}/tickets/${input.ticketId}`;
  const inner = `
    ${row("Utilizator", escapeHtml(input.username))}
    ${row("Subiect", escapeHtml(input.subject))}
    ${row("Categorie", escapeHtml(ticketCategoryLabel(input.category)))}
    ${row("Prioritate", priorityLabel)}
    <p style="margin:16px 0 4px;color:#fafafa;font-size:14px;font-weight:600">Mesaj</p>
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:14px;white-space:pre-wrap">${escapeHtml(input.message)}</p>
    ${button(url, "Deschide în dashboard")}
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: INVITE_TO,
    subject: `Ticket nou: ${input.subject} — ngig.cloud`,
    text: [
      `Utilizator: ${input.username}`,
      `Subiect: ${input.subject}`,
      `Categorie: ${ticketCategoryLabel(input.category)}`,
      `Prioritate: ${priorityLabel}`,
      "",
      "Mesaj:",
      input.message,
      "",
      `Deschide în dashboard: ${url}`,
    ].join("\n"),
    html: shell("Ticket nou de suport", inner),
  });

  if (error) throw new Error("Nu am putut trimite alerta.");
}

// Sent TO the support inbox (the owner) when a ticket is closed, so the admin
// side has an email trail for both ends of a ticket's life.
export async function sendTicketClosedAdmin(input: {
  username: string;
  subject: string;
  ticketId: string;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const url = `${dashboardOrigin()}/tickets/${input.ticketId}`;
  const inner = `
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      Ticketul <strong style="color:#fafafa">„${escapeHtml(input.subject)}”</strong>
      al utilizatorului <strong style="color:#fafafa">${escapeHtml(input.username)}</strong> a fost închis.
    </p>
    ${button(url, "Deschide în dashboard")}
    <p style="margin:16px 0 0;color:#71717a;font-size:12px">Utilizatorul îl poate redeschide răspunzând la el.</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: INVITE_TO,
    subject: `Ticket închis: ${input.subject} — ngig.cloud`,
    text: [
      `Ticketul „${input.subject}” al utilizatorului ${input.username} a fost închis.`,
      "",
      `Deschide în dashboard: ${url}`,
    ].join("\n"),
    html: shell("Ticket închis", inner),
  });

  if (error) throw new Error("Nu am putut trimite notificarea.");
}

// Sent TO the user when their support ticket is closed.
// Best-effort — its failure must not fail the close action.
export async function sendTicketClosed(input: {
  email: string;
  subject: string;
  ticketId: string;
}): Promise<void> {
  if (!API_KEY) throw new Error("Email indisponibil (config lipsă).");
  const resend = new Resend(API_KEY);

  const url = `${appOrigin()}/support/${input.ticketId}`;
  const inner = `
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      Salut,<br/>Ticketul tău <strong style="color:#fafafa">„${escapeHtml(input.subject)}”</strong> a fost închis.
    </p>
    <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;line-height:1.5">
      Dacă mai ai nevoie de ajutor, îl poți redeschide oricând răspunzând la el.
    </p>
    ${button(url, "Vezi ticketul")}
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: `Ticket închis: ${input.subject} — ngig.cloud`,
    text: [
      "Salut,",
      `Ticketul tău „${input.subject}” a fost închis.`,
      "",
      "Dacă mai ai nevoie de ajutor, îl poți redeschide răspunzând la el.",
      "",
      `Vezi ticketul: ${url}`,
      "",
      "— ngig.cloud",
    ].join("\n"),
    html: shell("Ticket închis", inner),
  });

  if (error) throw new Error("Nu am putut trimite notificarea.");
}
