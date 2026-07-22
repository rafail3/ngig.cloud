import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser, getManagerSections } from "@/server/admin/users";
import { UserDetailBody } from "@/components/dashboard/UserDetailBody";
import { UserDetailModal } from "@/components/dashboard/UserDetailModal";
import { UserDetailSkeleton } from "@/components/dashboard/UserDetailSkeleton";
import { SectionGate } from "@/components/dashboard/SectionGate";

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
  const viewerId = data?.claims?.sub as string | undefined;
  const isSelf = viewerId === id;
  let viewerIsSuper = false;
  if (viewerId) {
    const { data: viewer } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", viewerId)
      .single();
    viewerIsSuper = viewer?.is_super_admin ?? false;
  }

  // Only the super admin's manager-permissions card needs the current config.
  const managerSections =
    viewerIsSuper && user.role === "admin" && !user.is_super_admin
      ? await getManagerSections(id)
      : null;

  return (
    <UserDetailBody
      user={user}
      isSelf={isSelf}
      viewerIsSuper={viewerIsSuper}
      managerSections={managerSections}
    />
  );
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
        <SectionGate section="users">
          <InterceptedUserDetailContent params={params} />
        </SectionGate>
      </Suspense>
    </UserDetailModal>
  );
}
