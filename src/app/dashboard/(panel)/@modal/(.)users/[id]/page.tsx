import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/server/admin/users";
import { UserDetailBody } from "@/components/dashboard/UserDetailBody";
import { UserDetailModal } from "@/components/dashboard/UserDetailModal";

export const dynamic = "force-dynamic";

// Intercepts /users/[id] when navigated from within the dashboard → renders the
// detail as an overlay over the users list. A hard load hits the full page.
export default async function InterceptedUserDetail({
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

  return (
    <UserDetailModal>
      <UserDetailBody user={user} isSelf={isSelf} />
    </UserDetailModal>
  );
}
