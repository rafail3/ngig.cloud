"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { revalidateDrive } from "@/components/drive/useDriveData";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "motion/react";
import { File, Folder, X } from "lucide-react";
import { moveFileAction, moveFolderAction } from "@/app/drive-actions";

// Droppable id for the current-folder "everything else" area (see below).
const CURRENT_AREA_ID = "drop-current-area";

// Shared shape carried by every draggable item; droppables carry { destFolderId }.
// `parentId` is the folder the item currently lives in (the folder being viewed
// when the drag started) — used to skip a move into its own current folder.
export type DragData = {
  kind: "file" | "folder";
  id: string;
  name: string;
  parentId: string | null;
};
export type DropData = { destFolderId: string | null };

// How long to hover a folder/breadcrumb (mid-drag) before springing into it.
const SPRING_MS = 150;

// The item currently being dragged (or null). Rows read this to dim themselves —
// it's cleared reliably on drag end/cancel, so the dim never sticks as a "ghost".
const DragActiveContext = createContext<DragData | null>(null);
export function useDragActive(): DragData | null {
  return useContext(DragActiveContext);
}

// Keys (`${kind}:${id}`) of items whose move is in flight. Rows read this to show
// a loading ghost while the move runs (the action can be slow for big folders).
const PendingMoveContext = createContext<ReadonlySet<string>>(new Set());
export function usePendingMove(): ReadonlySet<string> {
  return useContext(PendingMoveContext);
}

/* Drag-and-drop for moving files/folders. A row is draggable; folder cards and
   breadcrumb segments are droppable. Pointer sensor (mouse) starts after a small
   move so clicks still work; touch sensor uses a long-press so taps and scroll
   are unaffected on mobile. The actual move runs on drop via the server actions. */
export function DriveDndProvider({
  folderId,
  children,
}: {
  folderId: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState<DragData | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [err, setErr] = useState<string | null>(null);

  // The dragged item, captured at drag start. dnd-kit clears `active.data` once
  // the source row unmounts (which happens during a spring-load navigation), so
  // we keep our own copy here and read THIS on drop — not the event's stale data.
  const activeRef = useRef<DragData | null>(null);

  // Spring-loaded navigation: hovering a folder/breadcrumb mid-drag navigates
  // into it after a short delay, without dropping — so you can drill down and
  // keep dragging seamlessly.
  const springTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const springOverId = useRef<string | number | null>(null);

  function clearSpring() {
    if (springTimer.current) clearTimeout(springTimer.current);
    springTimer.current = null;
    springOverId.current = null;
  }
  useEffect(() => clearSpring, []);

  // Auto-dismiss the error toast so a stale message never lingers.
  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => setErr(null), 4000);
    return () => clearTimeout(t);
  }, [err]);

  // Mouse only — drag-and-drop is a desktop affordance. On touch there is no
  // drag; selection is done via long-press (see useLongPress in the rows).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
  );

  // Prefer a specific target (folder card / breadcrumb) when the pointer is over
  // one; fall back to the big current-folder area only when nothing else is hit.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const hits = pointerWithin(args);
    const specific = hits.filter((h) => h.id !== CURRENT_AREA_ID);
    return specific.length > 0 ? specific : hits;
  }, []);

  function onDragStart(e: DragStartEvent) {
    const data = (e.active.data.current as DragData) ?? null;
    activeRef.current = data;
    setActive(data);
  }

  function onDragOver(e: DragOverEvent) {
    const over = e.over;
    const overId = over?.id ?? null;
    if (overId === springOverId.current) return; // same target — let the timer run
    if (springTimer.current) clearTimeout(springTimer.current);
    springTimer.current = null;
    springOverId.current = overId;
    if (!over) return;
    const dest = (over.data.current as DropData | undefined)?.destFolderId;
    if (dest === undefined) return; // stale/invalid target — never navigate to it
    if (dest === folderId) return; // already viewing this folder
    if (active?.kind === "folder" && active.id === dest) return; // don't enter the folder being dragged
    springTimer.current = setTimeout(() => {
      router.push(dest === null ? "/" : `/?folder=${dest}`);
      springTimer.current = null;
      springOverId.current = null;
    }, SPRING_MS);
  }

  async function onDragEnd(e: DragEndEvent) {
    clearSpring();
    const data = activeRef.current; // our copy — survives the source unmounting
    activeRef.current = null;
    setActive(null);
    if (!data || !e.over) return;

    // Resolve the destination. A droppable that just unmounted during a
    // spring-load navigation can momentarily lose its data (destFolderId
    // undefined) — fall back to the folder currently being viewed, which is
    // where the drop visually landed. `null` is a valid destination (root).
    const overData = e.over.data.current as DropData | undefined;
    const raw = overData?.destFolderId;
    const dest = raw === undefined ? folderId : raw;

    // No-ops: dropped back into its own folder, or a folder onto itself.
    if (dest === data.parentId) return;
    if (data.kind === "folder" && data.id === dest) return;

    // Show a loading ghost on the source item while the move runs. A move is a
    // metadata-only DB update (B2 objects never move, so file size is irrelevant)
    // and is usually near-instant; the ghost becomes visible when there's real
    // latency (slow network) — no artificial delay, so normal moves stay snappy.
    const key = `${data.kind}:${data.id}`;
    setPending((prev) => new Set(prev).add(key));
    try {
      const res =
        data.kind === "file"
          ? await moveFileAction(data.id, dest)
          : await moveFolderAction(data.id, dest);
      if (res.error) {
        setErr(res.error);
        return;
      }
      revalidateDrive();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <DndContext
      id="drive-dnd"
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        clearSpring();
        activeRef.current = null;
        setActive(null);
      }}
    >
      <DragActiveContext.Provider value={active}>
        <PendingMoveContext.Provider value={pending}>{children}</PendingMoveContext.Provider>
      </DragActiveContext.Provider>

      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="flex items-center gap-2 rounded-lg border border-indigo-400/60 bg-zinc-900/95 px-3 py-2 text-sm font-medium text-zinc-100 shadow-2xl backdrop-blur">
            {active.kind === "folder" ? (
              <Folder className="h-4 w-4 shrink-0 text-indigo-400" />
            ) : (
              <File className="h-4 w-4 shrink-0 text-zinc-300" />
            )}
            <span className="max-w-[220px] truncate">{active.name}</span>
          </div>
        )}
      </DragOverlay>

      {err && (
        <div className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-lg border border-red-900/60 bg-red-950/90 px-4 py-2.5 text-sm text-red-200 shadow-2xl backdrop-blur">
            <span>{err}</span>
            <button
              type="button"
              onClick={() => setErr(null)}
              aria-label="Închide"
              className="shrink-0 rounded p-0.5 text-red-400 transition hover:text-red-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </DndContext>
  );
}

/* Drop target for "the current folder". Its node is a full-screen fixed layer,
   so an item can be dropped anywhere on the page (not just exactly on a card or
   breadcrumb) — folder cards/breadcrumbs sit on top and win the collision, so
   this only catches drops in empty space. While a valid item hovers, a soft glow
   fades in from the screen edges as the drop indicator. */
export function CurrentFolderDropZone({
  folderId,
  children,
}: {
  folderId: string | null;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: CURRENT_AREA_ID,
    data: { destFolderId: folderId } satisfies DropData,
  });
  // Show the glow whenever a drag is actually in progress (active is only set once
  // the pointer moves — see the provider). Gives consistent "you're dragging, drop
  // anywhere here = this folder" feedback; not gated on isOver, which dnd-kit
  // doesn't recompute after a spring-load navigation unless the pointer moves.
  const data = useDragActive();
  const show = !!data;

  return (
    <>
      {children}
      <div ref={setNodeRef} aria-hidden className="pointer-events-none fixed inset-0 z-[45]">
        <AnimatePresence>
          {show && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
              style={{ boxShadow: "inset 0 0 150px 12px rgba(129,140,248,0.32)" }}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
