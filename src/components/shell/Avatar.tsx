import { Avatar as AvatarRoot, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Round accent avatar with the user's initial — the anchor of the user menus in
// both shells.
//
// Built on the shadcn/Radix avatar rather than a bare span: the accounts have no
// pictures today, and when they do, the image slot and its loading fallback are
// already here instead of being retrofitted into a div that only ever held a
// letter.
export function Avatar({
  username,
  className = "h-7 w-7 text-xs",
}: {
  username: string;
  className?: string;
}) {
  return (
    <AvatarRoot aria-hidden className={cn("shrink-0", className)}>
      <AvatarFallback className="select-none bg-indigo-500/15 font-semibold uppercase text-indigo-300 ring-1 ring-inset ring-indigo-500/25">
        {username.slice(0, 1) || "?"}
      </AvatarFallback>
    </AvatarRoot>
  );
}
