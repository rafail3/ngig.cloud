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

// Total bytes across the platform — used by upload enforcement.
export async function platformUsage(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("platform_total_usage");
  return Number(data ?? 0);
}
