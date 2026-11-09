import { ScanLine, Clock3, UserRound, CircleHelp } from "lucide-react";
import { ThemeSwitch } from "../shared/UI";
import type { AppTab } from "../../lib/navigation";

type Props = {
  tab: AppTab;
  setTab: (tab: AppTab) => void;
  onAccount?: () => void;
};

export function AppHeader({ tab, setTab, onAccount }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-page pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:h-20 sm:px-8">
        <button
          aria-label="RepLens home"
          onClick={() => {
            setTab("analyze");
          }}
          className="flex items-center gap-3 text-left"
        >
          <img src="/icon-light-192.png" alt="" className="size-11 rounded-xl dark:hidden" />
          <img src="/icon-192.png" alt="" className="hidden size-11 rounded-xl dark:block" />
          <span>
            <span className="block text-lg font-semibold leading-tight tracking-[-.025em]">
              RepLens<span className="text-accent">.</span>
            </span>
          </span>
        </button>
        <div className="hidden items-center gap-1 rounded-xl border border-line bg-panel p-1 sm:flex">
          {(["analyze", "history", "info", "account"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${tab === t ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
            >
              {t === "analyze" ? "Predict" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onAccount && (
            <button
              onClick={onAccount}
              aria-label="Open account"
              className="grid size-11 place-items-center rounded-xl border border-line bg-panel text-accent hover:border-accent/60 sm:hidden"
            >
              <UserRound size={18} />
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
      className="fixed inset-x-0 bottom-[calc(2px+env(safe-area-inset-bottom))] z-20 px-5 sm:hidden"
    >
      <div className="mx-auto grid h-[68px] max-w-[320px] grid-cols-4 rounded-full border border-line bg-panel/95 p-1 shadow-[0_18px_45px_rgba(0,0,0,.3)] backdrop-blur-xl">
        {(
          [
            { id: "analyze", label: "Predict", Icon: ScanLine },
            { id: "history", label: "History", Icon: Clock3 },
            { id: "info", label: "Info", Icon: CircleHelp },
            { id: "account", label: "Account", Icon: UserRound },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            aria-label={label}
            title={label}
            className={`flex items-center justify-center rounded-full transition ${tab === id ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
          >
            <Icon size={21} strokeWidth={tab === id ? 2 : 1.6} />
          </button>
        ))}
      </div>
    </nav>
  );
}
