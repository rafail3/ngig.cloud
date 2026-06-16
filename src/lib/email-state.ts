// Form-action states for the email flows (kept out of "use server" files).
export type InviteRequestState = {
  error?: string;
  ok?: boolean;
  values?: { name?: string; email?: string; message?: string };
};

export type ResetRequestState = { error?: string; ok?: boolean; email?: string };

export type ResetUpdateState = { error?: string };
