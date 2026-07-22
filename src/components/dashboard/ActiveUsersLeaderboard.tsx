import { Users } from "lucide-react";
import { ActiveUsersChart } from "@/components/dashboard/ActiveUsersChart";
import { ActiveUserRow } from "@/components/dashboard/ActiveUserRow";
import type { ActiveUser } from "@/server/admin/stats";

// Ranked list of the most active users over the chosen window: an activity-score
// bar chart on top, then a detailed per-user breakdown. Rows open the insights
// modal (see ActiveUserRow).
export function ActiveUsersLeaderboard({
  users,
  days,
}: {
  users: ActiveUser[];
  days: number;
}) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-500">
          <Users className="h-5 w-5" />
        </span>
        <p className="text-sm text-zinc-400">Nicio activitate de user în această perioadă.</p>
      </div>
    );
  }

  const top = users[0].score || 1;

  return (
    <div className="flex flex-col gap-5">
      <ActiveUsersChart users={users} />

      <div className="h-px bg-zinc-800/70" />

      <ol className="flex flex-col gap-1">
        {users.map((u, i) => (
          <li key={u.userId}>
            <ActiveUserRow user={u} rank={i} top={top} days={days} />
          </li>
        ))}
      </ol>
    </div>
  );
}
