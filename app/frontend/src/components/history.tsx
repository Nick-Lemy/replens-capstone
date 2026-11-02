import { useState } from "react";
import { Film, Trash2, Clock3 } from "lucide-react";
import type { SavedSession } from "../lib/types";
import { Button, seconds } from "./ui";
export function History({
  sessions,
  loading,
  onOpen,
  onRemove,
  onAnalyze,
}: {
  sessions: SavedSession[];
  loading: boolean;
  onOpen: (s: SavedSession) => void;
  onRemove: (id: string) => void;
  onAnalyze: () => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="animate-enter space-y-6">
      <div>
        <p className="mb-2 text-sm text-muted">A little perspective</p>
        <h1 className="text-[32px] font-semibold tracking-[-.04em]">
          Your sessions
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Saved on this device, ready to revisit.
        </p>
      </div>
      {loading ? (
        <p role="status" className="py-16 text-center text-sm text-muted">
          Loading sessions…
        </p>
      ) : !sessions.length ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-line bg-panel p-7 text-center">
          <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-soft">
            <Clock3 size={21} strokeWidth={1.5} />
          </span>
          <h2 className="font-medium">Room for your first set.</h2>
          <p className="mb-6 mt-2 max-w-xs text-sm leading-6 text-muted">
            Analyze a video, then save the result to find it here.
          </p>
          <Button onClick={onAnalyze}>Analyze a set</Button>
        </section>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="overflow-hidden rounded-2xl border border-line bg-panel"
            >
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => onOpen(s)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-soft">
                    <Film size={20} strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(s.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {s.result.rep_count} reps ·{" "}
                      {seconds(s.result.duration_s)}
                    </p>
                    {(s.result.model_choice || s.result.model) && (
                      <p className="mt-1 truncate text-xs text-muted">
                        {s.result.model_choice === "speed_only"
                          ? "Speed only"
                          : s.result.model_choice === "speed_shaking"
                            ? "Speed + shaking"
                            : (s.result.model?.display_name ??
                              s.result.model?.family ??
                              "Legacy model")}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  aria-label={`Delete ${s.title}`}
                  onClick={() => setConfirm(confirm === s.id ? null : s.id)}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              {confirm === s.id && (
                <div className="border-t border-line bg-soft p-4">
                  <p className="mb-3 text-sm">
                    Delete this saved video and result from this browser?
                  </p>
                  <div className="flex gap-2">
                    <Button secondary onClick={() => setConfirm(null)}>
                      Keep
                    </Button>
                    <Button
                      onClick={() => {
                        onRemove(s.id);
                        setConfirm(null);
                      }}
                    >
                      Delete session
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs leading-5 text-muted">
        History is stored locally. Clearing browser data removes saved sessions.
        Other devices will have their own history.
      </p>
    </div>
  );
}
