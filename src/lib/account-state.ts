// Result state for the account form actions (kept out of the "use server" file).
// Values are echoed back so inputs survive an error re-render.
export type AccountState = {
  error?: string;
  ok?: string;
  username?: string;
  password?: string; // current password (username / email form)
  oldPassword?: string;
  newPassword?: string;
  email?: string; // new email (email form)
};
