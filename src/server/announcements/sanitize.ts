import "server-only";
import sanitizeHtml from "sanitize-html";

// Sanitize the rich-text announcement body. Admin-authored, but we still run a
// strict whitelist server-side (defense in depth against stored XSS): only basic
// formatting + links survive; every attribute except a safe href is dropped.
export function sanitizeMessage(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["b", "strong", "i", "em", "u", "a", "br", "p", "div"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    // Absolute links must be http(s); relative internal paths ("/trash") pass
    // because they carry no scheme.
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: (_tag, attribs) => {
        const href = attribs.href ?? "";
        const out: Record<string, string> = { href };
        if (/^https?:\/\//i.test(href)) {
          out.target = "_blank";
          out.rel = "noopener noreferrer";
        }
        return { tagName: "a", attribs: out };
      },
    },
  });
}

// Plain-text projection, for validating that a message isn't empty and for
// length limits (ignoring markup).
export function messageText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
