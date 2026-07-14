"use client";

import { useState } from "react";

type Props = {
  name: string;
  autoComplete: string;
  defaultValue?: string;
  minLength?: number;
  placeholder?: string;
  // Override the field styling (the eye-button padding is always applied).
  className?: string;
  // Controlled mode — pass both. Forms that post FormData leave these out and
  // stay uncontrolled (defaultValue); callers that need to react to typing
  // (e.g. arming a destructive button) pass them.
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const defaultInputCls =
  "w-full rounded-xl border border-zinc-50/10 bg-zinc-50/5 px-4 py-2.5 text-base text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/60 focus:bg-zinc-50/10 focus:ring-1 focus:ring-indigo-400/40 sm:py-3";

export function PasswordInput({
  name,
  autoComplete,
  defaultValue,
  minLength,
  placeholder,
  className,
  value,
  onChange,
}: Props) {
  const [show, setShow] = useState(false);
  const controlled = value !== undefined;

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        name={name}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        {...(controlled ? { value, onChange } : { defaultValue })}
        placeholder={placeholder}
        className={`${className ?? defaultInputCls} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ascunde parola" : "Arată parola"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" x2="22" y1="2" y2="22" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
