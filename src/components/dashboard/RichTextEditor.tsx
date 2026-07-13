"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, Link2, Check, X } from "lucide-react";

// Lightweight rich-text editor (bold / italic / underline / link) over a
// contentEditable. Emits HTML via onChange; the server sanitizes it on save.
// Uncontrolled internally — remount (via a key) to reset it.
export function RichTextEditor({
  initialHtml,
  onChange,
  placeholder,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  function emit() {
    onChange(ref.current?.innerHTML ?? "");
  }

  // Seed the initial content ONCE, imperatively. The div must NOT use
  // dangerouslySetInnerHTML: on every parent re-render (each keystroke updates
  // the mirrored value upstream) React would reconcile the managed innerHTML and
  // fight the contentEditable — which made it nearly impossible to type. Setting
  // innerHTML via the ref keeps the content entirely outside React.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    onChange(ref.current?.innerHTML ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string) {
    document.execCommand(cmd);
    ref.current?.focus();
    emit();
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }

  function openLink() {
    saveSelection();
    setLinkUrl("");
    setLinkOpen(true);
  }

  function applyLink() {
    let url = linkUrl.trim();
    if (!url) {
      setLinkOpen(false);
      return;
    }
    // Bare domains → https; internal paths and full URLs stay as typed.
    if (!url.startsWith("/") && !/^https?:\/\//i.test(url)) url = `https://${url}`;

    ref.current?.focus();
    restoreSelection();
    const range = savedRange.current;
    if (range && !range.collapsed) {
      document.execCommand("createLink", false, url);
    } else {
      // No selection → insert the URL itself as the link text.
      document.execCommand("insertHTML", false, linkHtml(url));
    }
    setLinkOpen(false);
    emit();
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 focus-within:border-indigo-500/60">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 px-2 py-1.5">
        <ToolbarButton label="Bold" onClick={() => exec("bold")}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => exec("italic")}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Subliniat" onClick={() => exec("underline")}>
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Link" onClick={openLink}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>

        {linkOpen && (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") setLinkOpen(false);
              }}
              placeholder="https://… sau /profil"
              className="w-40 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-indigo-500/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={applyLink}
              aria-label="Adaugă link"
              className="rounded-md p-1 text-emerald-400 transition hover:bg-zinc-800"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLinkOpen(false)}
              aria-label="Anulează"
              className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        className="min-h-[7rem] px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none [overflow-wrap:anywhere] [&_a]:text-indigo-400 [&_a]:underline empty:before:text-zinc-600 empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}

function linkHtml(url: string): string {
  const external = /^https?:\/\//i.test(url);
  const esc = url.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const attrs = external ? ` target="_blank" rel="noopener noreferrer"` : "";
  return `<a href="${esc}"${attrs}>${esc}</a>`;
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep the editor's selection when clicking a toolbar button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
    >
      {children}
    </button>
  );
}
