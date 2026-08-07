import { Compass } from "lucide-react";
import { MissingRecord } from "@/components/common/MissingRecord";

export const metadata = { title: "Pagina nu există" };

/* The same safety net on the app side, so a mistyped URL or a stale link lands
   inside the shell — with the navigation still there — instead of on the
   framework's bare 404. */
export default function AppNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <MissingRecord
        icon={Compass}
        title="Pagina nu există"
        description="Adresa e greșită sau pagina a fost mutată. Întoarce-te la fișierele tale."
        backHref="/"
        backLabel="Înapoi la fișiere"
      />
    </div>
  );
}
