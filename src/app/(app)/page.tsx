import { Suspense } from "react";
import { DriveBoard } from "@/components/drive/DriveBoard";
import { DriveSkeleton } from "@/components/drive/DriveSkeleton";

export const metadata = { title: "Fișierele mele" };

// The board reads the folder from the URL and fetches its data on the client
// (SWR), so the page itself is a static shell. The <Suspense> covers the
// useSearchParams read on the first (cold) load.
export default function Home() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Suspense fallback={<DriveSkeleton />}>
        <DriveBoard />
      </Suspense>
    </div>
  );
}
