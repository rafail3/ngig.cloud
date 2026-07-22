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

export type UserActivityDetail = {
  username: string | null;
  memberSince: string | null;
  lastSeen: string | null;
  city: string | null;
  country: string | null;
  counts: {
    uploads: number;
    downloads: number;
    previews: number;
    searches: number;
    other: number;
    logins: number;
  };
  daily: { day: string; actions: number; logins: number }[];
  fileTypes: { category: string; count: number; bytes: number }[];
  storage: number;
  fileCount: number;
};

// Per-user activity for the leaderboard's insights modal (see the
// admin_user_activity RPC). Everything for one user, one round-trip.
export async function getUserActivity(userId: string, days = 30): Promise<UserActivityDetail> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("admin_user_activity", { uid: userId, days });
  const d = (data ?? {}) as Partial<UserActivityDetail>;
  return {
    username: d.username ?? null,
    memberSince: d.memberSince ?? null,
    lastSeen: d.lastSeen ?? null,
    city: d.city ?? null,
    country: d.country ?? null,
    counts: {
      uploads: Number(d.counts?.uploads ?? 0),
      downloads: Number(d.counts?.downloads ?? 0),
      previews: Number(d.counts?.previews ?? 0),
      searches: Number(d.counts?.searches ?? 0),
      other: Number(d.counts?.other ?? 0),
      logins: Number(d.counts?.logins ?? 0),
    },
    daily: (d.daily ?? []).map((r) => ({
      day: r.day,
      actions: Number(r.actions),
      logins: Number(r.logins),
    })),
    fileTypes: (d.fileTypes ?? []).map((r) => ({
      category: r.category,
      count: Number(r.count),
      bytes: Number(r.bytes),
    })),
    storage: Number(d.storage ?? 0),
    fileCount: Number(d.fileCount ?? 0),
  };
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
