import { TransfersBoard } from "@/components/transfer/TransfersBoard";

export const metadata = { title: "Transferuri" };

export default function TransfersPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Transferuri
      </h1>
      <p className="mt-1.5 mb-6 text-sm text-zinc-500">
        Fișiere și foldere trimise direct altor utilizatori. O cerere trebuie
        acceptată sau refuzată de destinatar înainte să ajungă în drive-ul lui.
      </p>

      <TransfersBoard />
    </div>
  );
}
