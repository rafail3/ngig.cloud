import type { ReactNode } from "react";
import Image from "next/image";
import { Montserrat } from "next/font/google";

// Montserrat ExtraBold — used only for the wordmark on the auth card.
const montserrat = Montserrat({ subsets: ["latin"], weight: "800" });

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
      <div className="relative w-full max-w-sm rounded-3xl border border-zinc-50/10 bg-zinc-50/5 p-5 shadow-2xl backdrop-blur-2xl sm:max-w-md sm:p-7">
        {/* subtle top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-50/25 to-transparent" />

        <div className="mb-5 flex flex-col items-center text-center sm:mb-6">
          <div className="mb-4 flex h-28 w-28 items-center justify-center rounded-3xl border border-zinc-50/30 bg-zinc-50/20 shadow-lg shadow-black/20 ring-1 ring-inset ring-zinc-50/30 backdrop-blur-xl sm:h-32 sm:w-32">
            <Image
              src="/ngig-mark.png"
              alt="ngig.cloud"
              width={256}
              height={256}
              priority
              className="h-24 w-24 drop-shadow sm:h-28 sm:w-28"
            />
          </div>
          <h1
            className={`${montserrat.className} text-2xl font-extrabold tracking-tight text-zinc-50 sm:text-3xl`}
          >
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
