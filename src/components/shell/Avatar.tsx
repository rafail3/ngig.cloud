// Round accent avatar with the user's initial — the anchor of the user menus
// in both shells.
export function Avatar({
  username,
  className = "h-7 w-7 text-xs",
}: {
  username: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center rounded-full bg-indigo-500/15 font-semibold uppercase text-indigo-300 ring-1 ring-inset ring-indigo-500/25 ${className}`}
    >
      {username.slice(0, 1) || "?"}
    </span>
  );
}
