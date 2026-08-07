import Image from "next/image";

/* The official ngig.cloud lockup: the cloud mark beside the name, with the
   domain in the brand accent.

   It lives in one component because it appears in five places — both shells,
   both loading skeletons and the public share page — and the previous
   arrangement (a flat PNG per theme) meant every one of them carried two
   <Image> tags and a `dark:` swap. The mark reads on light and dark alike, so
   one asset is enough, and the name is real text: it stays sharp at any size,
   scales with the type system, and picks up the light-mode mirror for free
   (`zinc-50` inverts to near-black, `indigo-400` to the darker brand blue). */
export function Wordmark({
  size = "md",
  className = "",
}: {
  /** `sm` where the row is tight (the dashboard column shares it with the role badge). */
  size?: "sm" | "md";
  className?: string;
}) {
  const s =
    size === "sm"
      ? { box: "gap-2 text-base", mark: "h-7 w-7" }
      : { box: "gap-2.5 text-lg", mark: "h-9 w-9" };

  return (
    <span
      className={`flex select-none items-center font-semibold tracking-tight text-zinc-50 ${s.box} ${className}`}
    >
      <Image
        src="/ngig-mark.png"
        alt=""
        width={256}
        height={256}
        priority
        className={`${s.mark} shrink-0`}
      />
      {/* One accessible name on the wrapper: the mark is decorative here, since
          the words beside it already say what it is. */}
      <span>
        ngig<span className="text-indigo-400">.cloud</span>
      </span>
    </span>
  );
}
