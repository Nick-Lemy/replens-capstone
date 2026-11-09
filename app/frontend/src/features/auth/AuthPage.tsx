import { CheckCircle2, LogOut, Mail } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "../../components/shared/UI";
import { AuthForm } from "./AuthForm";
import { AuthLayout } from "./AuthLayout";
import { authApi, type Account } from "./api";
import { emptyAuthForm, type AuthFormValues, type AuthMode } from "./types";

type Props = {
  account: Account | null | undefined;
  onExit: () => void;
  onAuthenticated: () => Promise<void>;
  onLogout: () => Promise<void>;
};

function modeFromUrl(account?: Account | null): AuthMode {
  const value = new URLSearchParams(window.location.search).get("auth");
  if (value === "signup" || value === "register") return "register";
  if (value === "reset-password") return "reset";
  if (value === "verify") return "verify";
  if (
    value === "forgot" ||
    value === "resend" ||
    value === "check-email" ||
    value === "change"
  )
    return value;
  return account ? "account" : "login";
}

const title: Record<AuthMode, string> = {
  login: "Welcome back.",
  register: "Create your account.",
  forgot: "Reset your password.",
  resend: "Verify your email.",
  reset: "Choose a new password.",
  verify: "Verifying your email.",
  "check-email": "Check your inbox.",
  account: "Your account.",
  change: "Change your password.",
};

const description: Record<AuthMode, string> = {
  login: "Sign in to your RepLens account.",
  register: "Create an account to get started with RepLens.",
  forgot: "We’ll email you a link to set a new password.",
  resend: "We’ll send a fresh verification link if your account needs one.",
  reset: "Use a password with at least 10 characters.",
  verify: "This will only take a moment.",
  "check-email": "Open the verification link we sent to your email address.",
  account: "Manage your sign-in details.",
  change: "Choose a new password for your account.",
};

export function AuthPage({
  account,
  onExit,
  onAuthenticated,
  onLogout,
}: Props) {
  const [mode, setMode] = useState<AuthMode>(() => modeFromUrl(account));
  const [form, setForm] = useState<AuthFormValues>(emptyAuthForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const verifiedToken = useRef<string | null>(null);
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const navigate = useCallback((next: AuthMode, notice = "") => {
    const route = next === "register" ? "signup" : next;
    window.history.pushState({}, "", `/?auth=${route}${window.location.hash}`);
    setMode(next);
    setMessage(notice);
    setError("");
    setForm((current) => ({
      ...current,
      password: "",
      confirmPassword: "",
      newPassword: "",
    }));
  }, []);

  useEffect(() => {
    const onPopState = () => setMode(modeFromUrl(account));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [account]);

  useEffect(() => {
    if (account && mode === "login") setMode("account");
  }, [account, mode]);

  useEffect(() => {
    if (mode !== "verify" || !token || verifiedToken.current === token) return;
    verifiedToken.current = token;
    setBusy(true);
    void authApi
      .verify(token)
      .then(async () => {
        await onAuthenticated();
        navigate("account", "Email verified. Your account is ready.");
      })
      .catch((failure: Error) => setError(failure.message))
      .finally(() => setBusy(false));
  }, [mode, token, onAuthenticated, navigate]);

  function update(key: keyof AuthFormValues, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (["register", "reset", "change"].includes(mode)) {
      const candidate = mode === "change" ? form.newPassword : form.password;
      if (candidate !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "register") {
        await authApi.register(
          form.name.trim(),
          form.email.trim(),
          form.password,
        );
        navigate("check-email");
      } else if (mode === "login") {
        await authApi.login(form.email.trim(), form.password);
        await onAuthenticated();
        navigate("account");
      } else if (mode === "forgot") {
        setMessage((await authApi.forgot(form.email.trim())).message);
      } else if (mode === "resend") {
        setMessage(
          (await authApi.resendVerification(form.email.trim())).message,
        );
      } else if (mode === "reset") {
        await authApi.reset(token, form.password);
        navigate("login", "Password changed. Sign in with your new password.");
      } else if (mode === "change") {
        await authApi.changePassword(form.password, form.newPassword);
        await onAuthenticated();
        navigate("account", "Password changed.");
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError("");
    setBusy(true);
    try {
      await onLogout();
      navigate("login", "You’ve signed out.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not sign out. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout onExit={onExit}>
      {mode === "login" || mode === "register" ? (
        <div className="mb-10 inline-flex rounded-xl border border-line bg-soft p-1 text-sm">
          <button
            type="button"
            onClick={() => navigate("login")}
            aria-current={mode === "login" ? "page" : undefined}
            className={`rounded-lg px-5 py-2 transition ${mode === "login" ? "bg-panel font-medium text-ink" : "text-muted hover:text-ink"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => navigate("register")}
            aria-current={mode === "register" ? "page" : undefined}
            className={`rounded-lg px-5 py-2 transition ${mode === "register" ? "bg-panel font-medium text-ink" : "text-muted hover:text-ink"}`}
          >
            Create account
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate(account ? "account" : "login")}
          className="mb-8 text-sm font-medium text-muted hover:text-ink"
        >
          ← {account ? "Back to account" : "Back to sign in"}
        </button>
      )}

      <div className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[.18em] text-muted">
          RepLens account
        </p>
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-.035em] sm:text-[42px]">
          {title[mode]}
        </h1>
        <p className="text-sm leading-6 text-muted">{description[mode]}</p>
      </div>

      {mode === "account" ? (
        <div className="space-y-4">
          <div className="surface-card p-5">
            <p className="text-sm font-semibold">{account?.name}</p>
            <p className="mt-1 text-sm text-muted">{account?.email}</p>
          </div>
          <Button
            className="w-full"
            secondary
            onClick={() => navigate("change")}
          >
            Change password
          </Button>
          <Button
            className="w-full"
            secondary
            busy={busy}
            onClick={() => void signOut()}
          >
            <LogOut size={17} /> Sign out
          </Button>
        </div>
      ) : mode === "check-email" || mode === "verify" ? (
        <div className="space-y-5">
          <div className="grid size-14 place-items-center rounded-2xl bg-soft">
            {mode === "check-email" ? (
              <Mail size={24} />
            ) : (
              <CheckCircle2 size={24} />
            )}
          </div>
          {mode === "check-email" && form.email && (
            <p className="text-sm text-muted">
              Sent to <span className="font-medium text-ink">{form.email}</span>
            </p>
          )}
          {mode === "verify" && (
            <p className="text-sm text-muted">
              {busy
                ? "Verifying your address…"
                : "Use the latest verification link from your email."}
            </p>
          )}
          {mode === "check-email" && (
            <Button
              className="w-full"
              secondary
              onClick={() => navigate("resend")}
            >
              Resend verification link
            </Button>
          )}
        </div>
      ) : (
        <AuthForm
          mode={mode}
          values={form}
          busy={busy}
          hasToken={Boolean(token)}
          onChange={update}
          onSubmit={(event) => void submit(event)}
          onForgot={() => navigate("forgot")}
        />
      )}

      {message && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-line bg-soft p-4 text-sm leading-6"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-red-300/50 bg-red-500/10 p-4 text-sm leading-6 text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {mode === "login" && (
        <p className="mt-8 text-center text-sm text-muted">
          New to RepLens?{" "}
          <button
            type="button"
            onClick={() => navigate("register")}
            className="font-semibold text-ink hover:underline"
          >
            Create an account
          </button>
        </p>
      )}
      {mode === "register" && (
        <p className="mt-8 text-center text-sm text-muted">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("login")}
            className="font-semibold text-ink hover:underline"
          >
            Sign in
          </button>
        </p>
      )}
      {mode === "login" && (
        <div className="mt-8 border-t border-line pt-6 text-center">
          <button
            type="button"
            onClick={() => navigate("resend")}
            className="text-xs text-muted hover:text-ink hover:underline"
          >
            Need a new verification email?
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
