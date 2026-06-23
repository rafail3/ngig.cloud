"use client";

import { useSyncExternalStore } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { loadLanguage } from "@uiw/codemirror-extensions-langs";

// Map a file extension to a CodeMirror language id (for syntax highlighting).
const LANG: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "sass",
  html: "html",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  markdown: "markdown",
  sh: "shell",
  bash: "shell",
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
  ini: "properties",
  env: "properties",
};

function languageExtensions(name: string) {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const id = ext ? LANG[ext] : undefined;
  const lang = id ? loadLanguage(id as Parameters<typeof loadLanguage>[0]) : null;
  return lang ? [lang] : [];
}

// True when the app is in dark mode (html.dark) — reactive to theme toggles.
function useIsDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => true,
  );
}

export default function TextEditor({
  value,
  onChange,
  fileName,
}: {
  value: string;
  onChange: (v: string) => void;
  fileName: string;
}) {
  const isDark = useIsDark();
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={isDark ? vscodeDark : vscodeLight}
      extensions={languageExtensions(fileName)}
      height="100%"
      className="h-full text-sm"
      basicSetup={{ lineNumbers: true, highlightActiveLine: true, tabSize: 2 }}
    />
  );
}
