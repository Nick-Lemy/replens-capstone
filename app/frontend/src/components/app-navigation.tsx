import { ScanLine, Clock3 } from "lucide-react";
import { ThemeSwitch } from "./ui";
type Tab = "analyze" | "history";
type Props = { tab: Tab; setTab: (tab: Tab) => void };
export function AppHeader({ tab, setTab }: Props) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-5 sm:px-8">
        <button
          aria-label="RepLens home"
          onClick={() => {
            setTab("analyze");
          }}
          className="flex items-center gap-2.5"
        >
          <span className="grid size-8 place-items-center rounded-[10px] bg-ink text-page">
            <ScanLine size={19} strokeWidth={1.6} />
          </span>
          <span className="text-lg font-semibold tracking-[-.055em]">
            RepLens<span className="text-muted">.</span>
          </span>
        </button>
        <div className="hidden items-center gap-1 rounded-full bg-soft p-1 sm:flex">
          {(["analyze", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${tab === t ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {t === "analyze" ? "Analyze" : "History"}
            </button>
          ))}
        </div>
        <ThemeSwitch />
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
      <div className="mx-auto grid h-17 max-w-md grid-cols-2">
        {(
          [
            { id: "analyze", label: "Analyze", Icon: ScanLine },
            { id: "history", label: "History", Icon: Clock3 },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1.5 text-[10px] font-medium transition ${tab === id ? "text-ink" : "text-muted"}`}
          >
            <Icon size={21} strokeWidth={tab === id ? 1.9 : 1.5} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
