import { SharedLinksBoard } from "@/components/drive/SharedLinksBoard";

export const metadata = { title: "Linkuri de partajare" };

export default function LinksPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Linkuri de partajare
      </h1>
      <p className="mt-1.5 mb-6 text-sm text-zinc-500">
        Toate linkurile publice active către fișierele și folderele tale. Oricine
        are un link îl poate deschide, fără cont, până când expiră sau îl revoci.
      </p>

      <SharedLinksBoard />
    </div>
  );
}
