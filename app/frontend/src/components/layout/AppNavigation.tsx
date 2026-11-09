import { ScanLine, Clock3, UserRound } from "lucide-react";
import { ThemeSwitch } from "../shared/UI";

type Tab = "analyze" | "history";
type Props = {
  tab: Tab;
  setTab: (tab: Tab) => void;
  accountName?: string;
  onAccount?: () => void;
};

export function AppHeader({ tab, setTab, accountName, onAccount }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-page/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 sm:px-8">
        <button
          aria-label="RepLens home"
          onClick={() => {
            setTab("analyze");
          }}
          className="flex items-center gap-3 text-left"
        >
          <span className="grid size-11 place-items-center rounded-[15px] bg-accent text-accent-ink shadow-[0_8px_24px_rgba(248,198,37,.18)]">
            <ScanLine size={21} strokeWidth={2} />
          </span>
          <span>
            <span className="block text-lg font-bold leading-tight tracking-[-.05em]">
              RepLens<span className="text-accent">.</span>
            </span>
            <span className="block text-[10px] leading-tight text-muted">
              Train with a clearer view
            </span>
          </span>
        </button>
        <div className="hidden items-center gap-1 rounded-full border border-line bg-panel p-1 sm:flex">
          {(["analyze", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-full px-5 py-2 text-xs font-semibold transition ${tab === t ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
            >
              {t === "analyze" ? "Predict" : "History"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onAccount && (
            <button
              onClick={onAccount}
              className="flex min-h-11 max-w-30 items-center gap-2 rounded-full border border-line bg-panel px-3 text-xs font-semibold hover:border-accent/60"
            >
              <UserRound size={16} className="shrink-0 text-accent" />
              <span className="truncate">{accountName ?? "Sign in"}</span>
            </button>
          )}
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}

export function AppNavigation({ tab, setTab }: Props) {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-4 z-20 px-5 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className="mx-auto grid h-[74px] max-w-[340px] grid-cols-2 rounded-full border border-line bg-panel/95 p-1 shadow-[0_18px_45px_rgba(0,0,0,.3)] backdrop-blur-xl">
        {(
          [
            { id: "analyze", label: "Predict", Icon: ScanLine },
            { id: "history", label: "History", Icon: Clock3 },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`flex items-center justify-center gap-2 rounded-full text-xs font-semibold transition ${tab === id ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
          >
            <Icon size={19} strokeWidth={tab === id ? 2 : 1.6} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
