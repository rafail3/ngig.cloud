// Form-action state types. Kept out of "use server" files, which may only
// export async functions.

export type LoginState = {
  error?: string;
  username?: string;
  password?: string;
};

export type RegisterState = {
  error?: string;
  values?: {
    code?: string;
    username?: string;
    email?: string;
    password?: string;
  };
};
