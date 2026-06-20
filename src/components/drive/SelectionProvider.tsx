"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// File metadata (size/mimeType/createdAt) is carried for files so the selection
// bar can show "Info" / download without re-fetching; folders omit it.
export type SelItem = {
  kind: "file" | "folder";
  id: string;
  name: string;
  size?: number;
  mimeType?: string | null;
  createdAt?: string;
};

export const selKey = (i: { kind: string; id: string }) => `${i.kind}:${i.id}`;

type ClickMods = { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };

type SelectionCtx = {
  selected: Map<string, SelItem>;
  count: number;
  isSelected: (key: string) => boolean;
  toggle: (item: SelItem) => void;
  clear: () => void;
  /** Handle a row click: returns true if a modifier (Ctrl/Cmd/Shift) consumed it
   *  for selection, so the caller should NOT open/preview the item. */
  handleClick: (item: SelItem, e: ClickMods) => boolean;
};

const Ctx = createContext<SelectionCtx | null>(null);

export function useSelection(): SelectionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSelection must be used within SelectionProvider");
  return c;
}

/* Multi-select state shared by the folder/file lists and the selection bar.
   `items` is the full visual order (folders then files) and is only used to
   resolve Shift-click ranges. Keyed by folderId at the call site, so navigating
   folders starts with a clean selection. */
export function SelectionProvider({
  items,
  folderId,
  children,
}: {
  items: SelItem[];
  folderId: string | null;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Map<string, SelItem>>(new Map());
  // Reset the selection when the folder changes — the React-sanctioned
  // "adjust state on prop change during render" pattern (no remount key, so the
  // DnD provider above stays mounted and a spring-load drag survives navigation).
  const [prevFolder, setPrevFolder] = useState(folderId);
  if (folderId !== prevFolder) {
    setPrevFolder(folderId);
    setSelected(new Map());
  }
  const anchor = useRef<string | null>(null);
  // Mirror the latest items + selection size into refs so the click handler reads
  // current values without being recreated on every render.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const activeRef = useRef(false);
  useEffect(() => {
    activeRef.current = selected.size > 0;
  }, [selected]);

  const toggle = useCallback((item: SelItem) => {
    const k = selKey(item);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(k)) next.delete(k);
      else next.set(k, item);
      return next;
    });
    anchor.current = k;
  }, []);

  // Shift-select the contiguous range between the anchor and this item.
  const selectRange = useCallback(
    (item: SelItem) => {
      const list = itemsRef.current;
      const to = list.findIndex((i) => selKey(i) === selKey(item));
      if (to < 0) {
        toggle(item);
        return;
      }
      const found = anchor.current
        ? list.findIndex((i) => selKey(i) === anchor.current)
        : -1;
      const from = found < 0 ? to : found; // stale/missing anchor → just this item
      const [lo, hi] = [Math.min(from, to), Math.max(from, to)];
      setSelected((prev) => {
        const next = new Map(prev);
        for (let x = lo; x <= hi; x++) next.set(selKey(list[x]), list[x]);
        return next;
      });
    },
    [toggle],
  );

  const clear = useCallback(() => {
    setSelected(new Map());
    anchor.current = null;
  }, []);

  const handleClick = useCallback(
    (item: SelItem, e: ClickMods) => {
      if (e.ctrlKey || e.metaKey) {
        toggle(item);
        return true;
      }
      if (e.shiftKey) {
        selectRange(item);
        return true;
      }
      // Once a selection exists, a plain click toggles too (no checkbox needed).
      if (activeRef.current) {
        toggle(item);
        return true;
      }
      return false;
    },
    [toggle, selectRange],
  );

  const value = useMemo<SelectionCtx>(
    () => ({
      selected,
      count: selected.size,
      isSelected: (k) => selected.has(k),
      toggle,
      clear,
      handleClick,
    }),
    [selected, toggle, clear, handleClick],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
