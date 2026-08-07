import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

/* What a page shows when the thing it is about is gone.

   The alternative is `notFound()`, which drops you onto a bare black page with
   "404 — This page could not be found." That is the right answer for a URL that
   never meant anything; it is the wrong answer for a record that existed a
   moment ago and was deleted, which is the common case here — an admin deletes
   an account while a colleague is reading it, or you come back to a bookmarked
   profile. The URL was fine. The row is not.

   So this says which thing is missing, in the product's own voice and inside
   its own chrome, and offers the one move that makes sense: back to the list it
   came from. */
export function MissingRecord({
  icon: Icon,
  title,
  description,
  backHref,
  backLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
      <div
        aria-hidden
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/50 text-zinc-500"
      >
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-400">{description}</p>
      <Link
        href={backHref}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
    </div>
  );
}
