// HTTP header values are ByteString: anything above U+00FF throws when the
// Headers object is built, and the whole response dies with it. Romanian file
// and folder names hit this constantly ("Achiziție…" blew up on the ț and the
// browser only ever saw a 404), so no user-supplied name goes into a header
// without passing through here: a stripped ASCII fallback for old clients, plus
// the RFC 5987 form that carries the real name.
export function contentDisposition(
  name: string,
  type: "inline" | "attachment" = "inline",
): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
