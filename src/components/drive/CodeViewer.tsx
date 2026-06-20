"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// Map a file extension to a Shiki language id. Anything unknown falls back to
// plain text (no highlighting, but still line-numbered).
const LANG: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  json: "json",
  jsonc: "jsonc",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  markdown: "markdown",
  sh: "bash",
  bash: "bash",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  sql: "sql",
  toml: "toml",
  ini: "ini",
  env: "ini",
};

function langOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return (m && LANG[m[1]]) ?? "text";
}

const THEMES = { light: "light-plus", dark: "dark-plus" } as const;

export function CodeViewer({
  code,
  fileName,
}: {
  code: string;
  fileName: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { codeToHtml } = await import("shiki");
        let out: string;
        try {
          out = await codeToHtml(code, {
            lang: langOf(fileName),
            themes: THEMES,
            defaultColor: false,
          });
        } catch {
          // Unknown/unsupported grammar — render as plain text instead.
          out = await codeToHtml(code, {
            lang: "text",
            themes: THEMES,
            defaultColor: false,
          });
        }
        if (active) setHtml(out);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [code, fileName]);

  // Highlighter failed to load — fall back to the previous plain <pre>.
  if (failed) {
    return (
      <pre className="max-h-[80vh] w-[min(85vw,52rem)] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 text-left font-mono text-xs leading-relaxed text-zinc-200">
        {code}
      </pre>
    );
  }

  if (html === null) {
    return <Loader2 className="my-10 h-6 w-6 animate-spin text-indigo-400" />;
  }

  return (
    <div
      className="code-preview max-h-[80vh] w-[min(85vw,52rem)] overflow-auto rounded-xl border border-zinc-800 text-left shadow-inner"
      // Shiki escapes the source, so the generated markup is safe to inject.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
