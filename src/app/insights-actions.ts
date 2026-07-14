"use server";

import { getInsights, type UserProfile } from "@/server/insights/engine";

// The caller's own private profile (RLS keeps it owner-scoped). Returns null on
// any failure so the UI can degrade quietly.
export async function getInsightsAction(): Promise<UserProfile | null> {
  try {
    return await getInsights();
  } catch {
    return null;
  }
}
