import {
  ArrowRight,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Button, Notice } from "../components/shared/UI";
import type { Account } from "../features/auth/api";

type Props = {
  account: Account | null | undefined;
  authEnabled: boolean;
  authReady: boolean;
  onAuth: (mode: "login" | "signup" | "forgot" | "account" | "change") => void;
  onSignOut: () => Promise<void>;
};

export function AccountPage({
  account,
  authEnabled,
  authReady,
  onAuth,
  onSignOut,
}: Props) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setError("");
    setSigningOut(true);
    try {
      await onSignOut();
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="animate-enter space-y-5">
      <div>
        <p className="eyebrow mb-2">Your space</p>
        <h1 className="text-[32px] font-semibold tracking-[-.035em] sm:text-[42px]">
          Account
        </h1>
        <p className="mt-2 text-sm text-muted">
          {account
            ? "Your details and sign-in options."
            : "Keep your sessions close."}
        </p>
      </div>

      {!authReady ? (
        <p role="status" className="text-sm text-muted">
          Loading account…
        </p>
      ) : account ? (
        <>
          <section className="surface-card flex items-center gap-4 p-5">
            <UserRound size={27} strokeWidth={1.7} className="shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{account.name}</p>
              <p className="mt-1 truncate text-xs text-muted">{account.email}</p>
            </div>
          </section>
          <p className="px-1 text-xs leading-5 text-muted">
            Password recovery links are sent to your account email.
          </p>
          <div className="surface-card overflow-hidden">
            <button
              onClick={() => onAuth("change")}
              className="flex w-full items-center gap-3 border-b border-line p-5 text-left text-sm font-medium hover:bg-soft"
            >
              <KeyRound size={18} className="text-accent" />
              Change password
              <ArrowRight size={16} className="ml-auto text-muted" />
            </button>
            <button
              onClick={() => onAuth("forgot")}
              className="flex w-full items-center gap-3 border-b border-line p-5 text-left text-sm font-medium hover:bg-soft"
            >
              <Mail size={18} className="text-accent" />
              Recover by email
              <ArrowRight size={16} className="ml-auto text-muted" />
            </button>
          </div>
          {error && <Notice>{error}</Notice>}
          <Button secondary busy={signingOut} onClick={() => void signOut()}>
            <LogOut size={16} />
            Sign out
          </Button>
        </>
      ) : authEnabled ? (
        <section className="surface-card space-y-4 p-6">
          <LogIn size={27} strokeWidth={1.7} className="text-accent" />
          <div>
            <h2 className="text-lg font-semibold">Sign in to RepLens</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Save and revisit your set results across devices.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onAuth("login")}>Sign in</Button>
            <Button secondary onClick={() => onAuth("signup")}>
              Create account
            </Button>
          </div>
          <button
            onClick={() => onAuth("forgot")}
            className="text-xs font-medium text-muted underline underline-offset-4 hover:text-ink"
          >
            Recover your password by email
          </button>
        </section>
      ) : (
        <section className="surface-card p-5 text-sm text-muted">
          Account features are unavailable while the authentication service is
          offline.
        </section>
      )}
    </div>
  );
}
