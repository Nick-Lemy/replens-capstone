export type AuthMode =
  | "login"
  | "register"
  | "forgot"
  | "resend"
  | "reset"
  | "verify"
  | "check-email"
  | "account"
  | "change";

export type AuthFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  newPassword: string;
};

export const emptyAuthForm: AuthFormValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  newPassword: "",
};
