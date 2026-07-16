"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getOfficeStatusAction } from "@/app/drive-actions";
import type { OfficeStatus } from "@/lib/office";
import { officeServerConfigured } from "./useOnlyOffice";

const Ctx = createContext<OfficeStatus | null>(null);

/** The resolved Office capability. Safe outside the provider — returns a sane default. */
export function useOfficeStatus(): OfficeStatus {
  return (
    useContext(Ctx) ?? {
      mode: "auto",
      up: false,
      configured: officeServerConfigured,
    }
  );
}

// Refresh a little slower than the server caches the health check (10s), so
// each poll is likely to hit a fresh answer without hammering.
const REFRESH_MS = 12_000;

export function OfficeStatusProvider({ children }: { children: ReactNode }) {
  // Until the first fetch lands, assume the server is down: better to briefly
  // hide an Edit button that should show than to offer one that errors.
  const [status, setStatus] = useState<OfficeStatus>({
    mode: "auto",
    up: false,
    configured: officeServerConfigured,
  });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const load = async () => {
      try {
        const s = await getOfficeStatusAction();
        if (alive.current) setStatus(s);
      } catch {
        // Keep the last known status on a transient failure.
      }
    };
    void load();
    const id = setInterval(load, REFRESH_MS);
    // Re-check when the tab regains focus — a laptop host may have come back
    // while the user was away, and we don't want them waiting a full interval.
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive.current = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return <Ctx.Provider value={status}>{children}</Ctx.Provider>;
}
