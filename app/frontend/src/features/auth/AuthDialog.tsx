import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { authApi, type Account } from "./api";

type Mode = "login" | "register" | "forgot" | "resend" | "reset" | "verify" | "account" | "change";
type Props = { account: Account | null | undefined; onClose: () => void; onAuthenticated: () => Promise<void>; onLogout: () => Promise<void> };

const inputStyle = "w-full rounded-xl border border-line bg-page px-3 py-3 text-sm text-ink outline-none focus:border-ink";
const buttonStyle = "w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-page disabled:opacity-50";

export function AuthDialog({ account, onClose, onAuthenticated, onLogout }: Props) {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get("auth");
  const token = params.get("token") ?? "";
  const [mode, setMode] = useState<Mode>(initial === "reset-password" ? "reset" : initial === "verify" ? "verify" : account ? "account" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (account && mode === "login") setMode("account");
  }, [account, mode]);

  useEffect(() => {
    if (mode !== "verify" || !token) return;
    setBusy(true);
    void authApi.verify(token).then(async () => {
      window.history.replaceState({}, "", window.location.pathname);
      await onAuthenticated();
      setMode("account");
      setMessage("Email verified. Your account is ready.");
    }).catch((failure: Error) => setError(failure.message)).finally(() => setBusy(false));
  }, [mode, token, onAuthenticated]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "register") {
        setMessage((await authApi.register(name, email, password)).message);
      } else if (mode === "login") {
        await authApi.login(email, password);
        await onAuthenticated();
        setMode("account");
      } else if (mode === "forgot") {
        setMessage((await authApi.forgot(email)).message);
      } else if (mode === "resend") {
        setMessage((await authApi.resendVerification(email)).message);
      } else if (mode === "reset") {
        setMessage((await authApi.reset(token, password)).message);
        window.history.replaceState({}, "", window.location.pathname);
        setMode("login");
      } else if (mode === "change") {
        setMessage((await authApi.changePassword(password, newPassword)).message);
        setPassword("");
        setNewPassword("");
        setMode("account");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="RepLens account" className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{mode === "register" ? "Create account" : mode === "forgot" ? "Reset password" : mode === "resend" ? "Verify your email" : mode === "reset" ? "Choose a new password" : mode === "verify" ? "Verify email" : mode === "change" ? "Change password" : mode === "account" ? "Your account" : "Sign in"}</h2>
          <button onClick={onClose} aria-label="Close account dialog" className="rounded-lg p-2 hover:bg-soft"><X size={18} /></button>
        </div>
        {mode === "account" ? (
          <div className="space-y-4 text-sm">
            <p>{account?.name}<br /><span className="text-muted">{account?.email}</span></p>
            <button className={buttonStyle} onClick={() => switchMode("change")}>Change password</button>
            <button className="w-full rounded-xl border border-line px-4 py-3 font-medium" onClick={() => void onLogout().then(() => switchMode("login")).catch((failure: Error) => setError(failure.message))}>Sign out</button>
          </div>
        ) : mode === "verify" ? <p className="text-sm text-muted">{busy ? "Verifying your email…" : "Use the latest verification link from your email."}</p> : (
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            {mode === "register" && <input className={inputStyle} aria-label="Name" placeholder="Name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />}
            {["register", "login", "forgot", "resend"].includes(mode) && <input className={inputStyle} aria-label="Email" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />}
            {["register", "login", "reset", "change"].includes(mode) && <input className={inputStyle} aria-label={mode === "change" ? "Current password" : "Password"} type="password" placeholder={mode === "change" ? "Current password" : "Password (at least 10 characters)"} autoComplete={mode === "login" || mode === "change" ? "current-password" : "new-password"} minLength={mode === "change" ? undefined : 10} value={password} onChange={(event) => setPassword(event.target.value)} required />}
            {mode === "change" && <input className={inputStyle} aria-label="New password" type="password" placeholder="New password (at least 10 characters)" autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />}
            <button className={buttonStyle} disabled={busy || mode === "reset" && !token}>{busy ? "Please wait…" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "resend" ? "Send verification link" : mode === "reset" ? "Reset password" : mode === "change" ? "Save password" : "Sign in"}</button>
          </form>
        )}
        {message && <p role="status" className="mt-4 text-sm text-ink">{message}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          {mode === "login" && <><button onClick={() => switchMode("register")}>Create account</button><button onClick={() => switchMode("forgot")}>Forgot password?</button><button onClick={() => switchMode("resend")}>Resend verification</button></>}
          {["register", "forgot", "resend", "reset"].includes(mode) && <button onClick={() => switchMode("login")}>Back to sign in</button>}
          {mode === "change" && <button onClick={() => switchMode("account")}>Back to account</button>}
        </div>
      </section>
    </div>
  );
}
