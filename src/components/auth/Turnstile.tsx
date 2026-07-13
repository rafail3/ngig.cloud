"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile, rendered EXPLICITLY so it works on every page and on
// client-side navigation (login -> register). The script is loaded once
// (guarded), and render/remove are wrapped so React StrictMode's double-invoke
// in dev doesn't spam "already loaded" / "cannot find widget" warnings.
// Renders only when a site key is set (local dev without keys still works).
// Cloudflare injects a hidden `cf-turnstile-response` input into the
// surrounding <form>, which the server action verifies.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, any>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function ensureScript() {
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = SCRIPT_SRC;
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

// `resetSignal` should change after each form submit (pass the action state).
// Turnstile tokens are single-use, so we reset the widget on every response to
// hand the next attempt a fresh token — otherwise a second submit reuses a
// spent token and fails verification.
export function Turnstile({ resetSignal }: { resetSignal?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (idRef.current && window.turnstile) {
      try {
        window.turnstile.reset(idRef.current);
      } catch {
        // widget not ready / already reset — ignore
      }
    }
  }, [resetSignal]);

  useEffect(() => {
    if (!siteKey) return;
    ensureScript();
    let cancelled = false;

    const render = () => {
      if (cancelled || idRef.current || !window.turnstile || !ref.current) return;
      try {
        // Invisible widget type (configured on the sitekey in the Cloudflare
        // dashboard): never shows UI, runs the check in the background, and
        // injects the hidden cf-turnstile-response input for the server action.
        // theme/size/appearance are irrelevant for invisible widgets.
        idRef.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
        });
      } catch {
        // widget container not ready yet — the poll will retry
      }
    };

    let timer: ReturnType<typeof setInterval> | undefined;
    if (window.turnstile) render();
    else {
      timer = setInterval(() => {
        if (window.turnstile) {
          clearInterval(timer);
          render();
        }
      }, 150);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (idRef.current && window.turnstile) {
        try {
          window.turnstile.remove(idRef.current);
        } catch {
          // already cleaned up by Cloudflare — ignore
        }
        idRef.current = null;
      }
    };
  }, []);

  if (!siteKey) return null;
  // sr-only keeps the invisible widget out of the layout flow, so the forms
  // stay compact (no reserved row/gap). Cloudflare still runs the check and
  // injects the hidden token input inside this element (which is in the form).
  return <div ref={ref} className="sr-only" />;
}
