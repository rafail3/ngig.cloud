import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Overview = {
  fileCount: number;
  totalSize: number;
  userCount: number;
  onlineCount: number;
};

export type FileType = { category: string; count: number; size: number };
export type UploadDay = { day: string; count: number; size: number };
export type LoginDay = { day: string; count: number };

export type ActiveUser = {
  userId: string;
  username: string;
  uploads: number;
  downloads: number;
  otherActions: number;
  logins: number;
  score: number;
  lastActive: string | null;
  storageBytes: number;
  fileCount: number;
  city: string | null;
  country: string | null;
};

// Windows the Overview leaderboard offers (days).
export const ACTIVE_USER_WINDOWS = [7, 30, 90] as const;
export type ActiveUserWindow = (typeof ACTIVE_USER_WINDOWS)[number];

export async function getOverview(): Promise<Overview> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("admin_overview");
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    fileCount: Number(row.file_count ?? 0),
    totalSize: Number(row.total_size ?? 0),
    userCount: Number(row.user_count ?? 0),
    onlineCount: Number(row.online_count ?? 0),
  };
}

export async function getFileTypes(): Promise<FileType[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("admin_file_types");
  return (data ?? []).map((r: { category: string; count: number; size: number }) => ({
    category: r.category,
    count: Number(r.count),
    size: Number(r.size),
  }));
}

export async function getUploadsDaily(days = 30): Promise<UploadDay[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("admin_uploads_daily", { days });
  return (data ?? []).map((r: { day: string; count: number; size: number }) => ({
    day: r.day,
    count: Number(r.count),
    size: Number(r.size),
  }));
}

export async function getLoginsDaily(days = 30): Promise<LoginDay[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("admin_logins_daily", { days });
  return (data ?? []).map((r: { day: string; count: number }) => ({
    day: r.day,
    count: Number(r.count),
  }));
}

// The most active users over the last `days`, ranked by a weighted activity
// score (see the admin_active_users RPC). Aggregated in the DB.
export async function getActiveUsers(days = 30, limit = 10): Promise<ActiveUser[]> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("admin_active_users", { days, lim: limit });
  return (data ?? []).map(
    (r: {
      user_id: string;
      username: string | null;
      uploads: number;
      downloads: number;
      other_actions: number;
      logins: number;
      score: number;
      last_active: string | null;
      storage_bytes: number;
      file_count: number;
      last_city: string | null;
      last_country: string | null;
    }) => ({
      userId: r.user_id,
      username: r.username ?? "—",
      uploads: Number(r.uploads),
      downloads: Number(r.downloads),
      otherActions: Number(r.other_actions),
      logins: Number(r.logins),
      score: Number(r.score),
      lastActive: r.last_active,
      storageBytes: Number(r.storage_bytes),
      fileCount: Number(r.file_count),
      city: r.last_city,
      country: r.last_country,
    }),
  );
}

// Total bytes across the platform — used by upload enforcement.
export async function platformUsage(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("platform_total_usage");
  return Number(data ?? 0);
}
