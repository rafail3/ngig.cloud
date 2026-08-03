// Client-safe vocabulary for the user directory ("Utilizatori").
// No server imports — pulled into the directory page, the profile panel and the
// drive search results.

export type DirectoryUser = {
  id: string;
  username: string;
  createdAt: string;
};

// What a public profile exposes. Deliberately NO email and NO role —
// admin/manager standing is internal information, not part of a public profile
// (see the migration's comment). `sharedTransfers` counts transfers between the
// VIEWER and this user in either direction, so it is the viewer's own
// relationship data.
export type PublicProfile = DirectoryUser & {
  sharedTransfers: number;
};

// How many users one directory page requests.
export const DIRECTORY_PAGE_SIZE = 24;

// How many users the drive search surfaces inline before deferring to /users.
export const SEARCH_USER_PREVIEW = 4;
