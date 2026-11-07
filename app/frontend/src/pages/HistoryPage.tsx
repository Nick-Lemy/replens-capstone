import { SessionCard } from "../components/history/SessionCard";
import { useState } from "react";
import { Clock3 } from "lucide-react";
import type { SavedSession } from "../lib/types";
import { Button } from "../components/shared/UI";

export function HistoryPage({
  sessions,
  loading,
  error,
  onRetry,
  synced,
  onOpen,
  onRemove,
  onAnalyze,
}: {
  sessions: SavedSession[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  synced: boolean;
  onOpen: (session: SavedSession) => void;
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
          {synced
            ? "Your results are saved to your account. Videos stay on this device."
            : "Saved on this device, ready to revisit."}
        </p>
      </div>
      {loading ? (
        <p role="status" className="py-16 text-center text-sm text-muted">
          Loading sessions…
        </p>
      ) : error ? (
        <section className="rounded-2xl border border-line bg-panel p-6 text-center">
          <p className="mb-4 text-sm text-muted">
            Could not load your saved sessions.
          </p>
          <Button secondary onClick={onRetry}>
            Try again
          </Button>
        </section>
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
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              synced={synced}
              confirming={confirm === session.id}
              onOpen={onOpen}
              onToggleConfirm={() =>
                setConfirm(confirm === session.id ? null : session.id)
              }
              onCancelConfirm={() => setConfirm(null)}
              onConfirmRemove={() => {
                onRemove(session.id);
                setConfirm(null);
              }}
            />
          ))}
        </div>
      )}
      <p className="text-xs leading-5 text-muted">
        {synced
          ? "Your saved results follow your account. Videos can be replayed only on the device where you saved them."
          : "Guest history is stored locally. Clearing browser data removes saved sessions."}
      </p>
    </div>
  );
}
