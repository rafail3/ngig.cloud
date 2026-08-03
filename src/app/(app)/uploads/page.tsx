import { UploadsBoard } from "@/components/drive/UploadsBoard";

export const metadata = { title: "Încărcări" };

export default function UploadsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Încărcări</h1>
      <p className="mt-1.5 mb-6 text-sm text-zinc-400">
        Fișierele care se încarcă acum, cu viteză, timp rămas și progres pentru
        fiecare. Încărcările continuă și dacă reîncarci pagina.
      </p>

      <UploadsBoard />
    </div>
  );
}
