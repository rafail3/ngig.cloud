// Shared, client-safe constants for the "most active users" leaderboard.
// Kept out of server/admin/stats.ts (which imports "server-only") so the client
// window picker can reference them without pulling the admin client into the
// browser bundle.

// Rolling windows (days) the Overview leaderboard offers.
export const ACTIVE_USER_WINDOWS = [7, 30, 90] as const;
export type ActiveUserWindow = (typeof ACTIVE_USER_WINDOWS)[number];
