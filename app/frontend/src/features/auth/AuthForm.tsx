import { ArrowRight } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "../../components/shared/UI";
import { AuthField } from "./AuthFields";
import type { AuthFormValues, AuthMode } from "./types";

type FormMode = Exclude<AuthMode, "account" | "check-email" | "verify">;

type Props = {
  mode: FormMode;
  values: AuthFormValues;
  busy: boolean;
  hasToken: boolean;
  onChange: (field: keyof AuthFormValues, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onForgot: () => void;
};

const action: Record<FormMode, string> = {
  login: "Sign in",
  register: "Create account",
  forgot: "Send reset link",
  resend: "Send verification link",
  reset: "Save new password",
  change: "Update password",
};

export function AuthForm({
  mode,
  values,
  busy,
  hasToken,
  onChange,
  onSubmit,
  onForgot,
}: Props) {
  const needsEmail = ["login", "register", "forgot", "resend"].includes(mode);
  const needsPassword = ["login", "register", "reset", "change"].includes(mode);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {mode === "register" && (
        <AuthField
          id="auth-name"
          label="Your name"
          autoComplete="name"
          placeholder="How should we call you?"
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          maxLength={120}
          required
        />
      )}
      {needsEmail && (
        <AuthField
          id="auth-email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(event) => onChange("email", event.target.value)}
          required
        />
      )}
      {needsPassword && (
        <AuthField
          id="auth-password"
          label={
            mode === "change"
              ? "Current password"
              : mode === "reset"
                ? "New password"
                : "Password"
          }
          hint={
            mode === "register" || mode === "reset"
              ? "At least 10 characters"
              : undefined
          }
          type="password"
          autoComplete={
            mode === "login" || mode === "change"
              ? "current-password"
              : "new-password"
          }
          value={values.password}
          onChange={(event) => onChange("password", event.target.value)}
          minLength={mode === "change" ? undefined : 10}
          required
        />
      )}
      {mode === "change" && (
        <AuthField
          id="auth-new-password"
          label="New password"
          hint="At least 10 characters"
          type="password"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(event) => onChange("newPassword", event.target.value)}
          minLength={10}
          required
        />
      )}
      {["register", "reset", "change"].includes(mode) && (
        <AuthField
          id="auth-confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(event) => onChange("confirmPassword", event.target.value)}
          minLength={10}
          required
        />
      )}
      {mode === "login" && (
        <div className="text-right">
          <button
            type="button"
            onClick={onForgot}
            className="text-sm font-medium text-ink hover:underline"
          >
            Forgot password?
          </button>
        </div>
      )}
      <Button
        type="submit"
        className="w-full"
        busy={busy}
        disabled={mode === "reset" && !hasToken}
      >
        {action[mode]}
        {!busy && <ArrowRight size={17} />}
      </Button>
    </form>
  );
}
