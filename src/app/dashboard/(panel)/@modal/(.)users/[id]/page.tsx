import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/server/admin/users";
import { UserDetailBody } from "@/components/dashboard/UserDetailBody";
import { UserDetailModal } from "@/components/dashboard/UserDetailModal";
import { UserDetailSkeleton } from "@/components/dashboard/UserDetailSkeleton";

// `id` (dynamic param), the user lookup and the self-check are per-request, so
// they resolve inside <Suspense> — the modal frame opens instantly and the body
// streams into it.
async function InterceptedUserDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isSelf = (data?.claims?.sub as string | undefined) === id;

  return <UserDetailBody user={user} isSelf={isSelf} />;
}

// Intercepts /users/[id] when navigated from within the dashboard → renders the
// detail as an overlay over the users list. A hard load hits the full page.
export default function InterceptedUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <UserDetailModal>
      <Suspense fallback={<UserDetailSkeleton />}>
        <InterceptedUserDetailContent params={params} />
      </Suspense>
    </UserDetailModal>
  );
}
