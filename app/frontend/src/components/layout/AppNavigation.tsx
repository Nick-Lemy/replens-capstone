import { ScanLine, Clock3, Info } from "lucide-react";
import { ThemeSwitch } from "../shared/UI";

type Tab = "analyze" | "history" | "info";
type Props = { tab: Tab; setTab: (tab: Tab) => void; accountName?: string; onAccount?: () => void };

export function AppHeader({ tab, setTab, accountName, onAccount }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-5 sm:px-8">
        <button
          aria-label="RepLens home"
          onClick={() => {
            setTab("analyze");
          }}
          className="flex items-center gap-2.5"
        >
          <span className="grid size-8 place-items-center rounded-[10px] bg-accent text-white shadow-[0_0_12px_rgba(242,107,29,0.4)]">
            <ScanLine size={19} strokeWidth={1.6} />
          </span>
          <span className="text-lg font-semibold tracking-[-.055em]">
            Rep<span className="text-accent">Lens</span><span className="text-muted">.</span>
          </span>
        </button>
        <div className="hidden items-center gap-1 rounded-full bg-soft p-1 sm:flex">
          {(["analyze", "history", "info"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${tab === t ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {t === "analyze" ? "Predict" : t === "history" ? "History" : "Info"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onAccount && <button onClick={onAccount} className="rounded-full border border-line px-3 py-2 text-xs font-medium text-muted hover:bg-soft hover:text-ink transition">{accountName ?? "Sign in"}</button>}
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
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
    >
      <div className="mx-auto grid h-17 max-w-md grid-cols-3">
        {(
          [
            { id: "analyze", label: "Predict", Icon: ScanLine },
            { id: "history", label: "History", Icon: Clock3 },
            { id: "info", label: "Info", Icon: Info },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${tab === id ? "text-accent" : "text-muted"}`}
          >
            <Icon size={21} strokeWidth={tab === id ? 1.9 : 1.5} />
            {label}
            {tab === id && (
              <span className="mt-0.5 size-1 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
