import type { ReactNode } from "react";

export function AuthCard({
  subtitle,
  children,
  footer,
}: {
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-950 px-4 py-6 sm:py-10">
      {/* aurora background */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-[32rem] w-[32rem] rounded-full bg-indigo-600/30 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[34rem] w-[34rem] rounded-full bg-violet-700/25 blur-[130px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-fuchsia-600/10 blur-[120px]" />

      {/* glass card */}
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-2xl sm:max-w-md sm:p-7">
        {/* subtle top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="mb-5 flex flex-col items-center text-center sm:mb-6">
          <div className="mb-3.5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-lg shadow-black/20 ring-1 ring-inset ring-white/30 backdrop-blur-xl">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white drop-shadow"
            >
              <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.34 9.4 4 4 0 0 0 7 17h10.5Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            ngig<span className="text-indigo-400">.cloud</span>
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>
        </div>

        {children}

        {footer && (
          <div className="mt-6 text-center text-sm text-zinc-400 sm:mt-8">{footer}</div>
        )}
      </div>
    </div>
  );
}
