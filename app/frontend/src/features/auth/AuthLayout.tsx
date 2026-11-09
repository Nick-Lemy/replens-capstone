import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeSwitch } from "../../components/shared/UI";

type Props = {
  children: ReactNode;
  onExit: () => void;
};

export function AuthLayout({ children, onExit }: Props) {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="sticky top-0 z-30 bg-page/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-2.5"
            aria-label="Return to RepLens"
          >
            <img src="/icon-light-192.png" alt="" className="size-9 rounded-[11px] dark:hidden" />
            <img src="/icon-192.png" alt="" className="hidden size-9 rounded-[11px] dark:block" />
            <span className="text-lg font-semibold tracking-[-.055em]">
              RepLens<span className="text-accent">.</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-muted transition hover:bg-soft hover:text-ink"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back to app</span>
            </button>
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:min-h-[calc(100dvh-4.5rem)] lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-20 lg:py-12">
        <aside className="relative hidden min-h-[600px] overflow-hidden rounded-2xl border border-line bg-stage p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-30 -top-30 size-100 rounded-full border border-white/12" />
          <div className="absolute -right-18 -top-18 size-76 rounded-full border border-white/12" />
          <div className="absolute right-3 top-3 size-44 rounded-full border border-white/12" />
          <div className="relative flex items-center gap-2 text-xs font-medium uppercase tracking-[.2em] text-white/60">
            <span className="size-2 rounded-full bg-accent" />
            Make each rep count
          </div>
          <div className="relative max-w-sm space-y-6">
            <div
              className="flex h-36 items-end gap-2 opacity-90"
              aria-hidden="true"
            >
              {[33, 45, 60, 53, 74, 66, 88, 78, 99, 84, 111, 101].map(
                (height, index) => (
                  <span
                    key={index}
                    className={`w-4 rounded-full ${index > 8 ? "bg-accent" : "bg-white/35"}`}
                    style={{ height }}
                  />
                ),
              )}
            </div>
            <h2 className="text-4xl font-semibold leading-[1.08] tracking-[-.055em]">
              Understand muscle fatigue, one rep at a time.
            </h2>
            <p className="max-w-xs text-sm leading-6 text-white/60">
              Record a curl set and see how close you may be to your lifting limit.
            </p>
          </div>
          <div className="relative flex items-center gap-2 text-xs text-white/50">
            A closer look at your effort <ArrowUpRight size={14} />
          </div>
        </aside>

        <div className="mx-auto w-full max-w-[430px] animate-enter py-4 lg:py-0">
          {children}
        </div>
      </main>
    </div>
  );
}
