import { Compass } from "lucide-react";
import { MissingRecord } from "@/components/common/MissingRecord";

export const metadata = { title: "Pagina nu există" };

/* Catches anything in the dashboard that still calls `notFound()`, plus any URL
   under it that matches no route at all. Without this the framework's own page
   takes over — a bare "404 — This page could not be found." on black, outside
   the shell, with no navigation and no way back except the browser's own. */
export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <MissingRecord
        icon={Compass}
        title="Pagina nu există"
        description="Adresa e greșită sau pagina a fost mutată. Ia-o de la capăt din Overview."
        backHref="/"
        backLabel="Înapoi la Overview"
      />
    </div>
  );
}
