import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewTicketForm } from "@/components/support/NewTicketForm";

export const metadata = { title: "Ticket nou" };

export default function NewTicketPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" /> Înapoi la suport
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
          Ticket nou
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Completează detaliile și îți răspundem cât putem de repede.
        </p>
      </div>

      <NewTicketForm />
    </div>
  );
}
