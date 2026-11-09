import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle, Moon, Sun, X, CircleAlert } from "lucide-react";
import { useState } from "react";

export function Button({
  children,
  secondary = false,
  busy = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  secondary?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 ${secondary ? "border border-line bg-soft text-ink hover:border-accent/60 hover:bg-panel" : "bg-accent text-accent-ink shadow-[0_8px_22px_rgba(248,198,37,.15)] hover:brightness-110"} ${className}`}
    >
      {busy && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function ThemeSwitch() {
  const [dark, setDark] = useState(
    document.documentElement.classList.contains("dark"),
  );

  return (
    <button
      className="grid size-11 place-items-center rounded-xl text-muted transition hover:bg-soft hover:text-ink"
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("replens-theme", next ? "dark" : "light");
        } catch {
          /* Theme still works without storage. */
        }
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", next ? "#17191e" : "#f5f5f2");
      }}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

export function Notice({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-line bg-soft p-4 text-sm leading-relaxed text-muted"
    >
      <CircleAlert size={17} className="mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button aria-label="Dismiss message" onClick={onClose} className="p-1">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export const seconds = (value: number) =>
  `${Math.floor(value / 60)}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
