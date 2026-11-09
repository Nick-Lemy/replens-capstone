import { ArrowUpRight, Dumbbell, Trash2 } from "lucide-react";
import type { SavedSession } from "../../lib/types";
import { Button, seconds } from "../shared/UI";

export function SessionCard({
  session,
  synced,
  confirming,
  onOpen,
  onToggleConfirm,
  onCancelConfirm,
  onConfirmRemove,
}: {
  session: SavedSession;
  synced: boolean;
  confirming: boolean;
  onOpen: (session: SavedSession) => void;
  onToggleConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmRemove: () => void;
}) {
  return (
    <div className="surface-card overflow-hidden transition hover:border-accent/50">
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => onOpen(session)}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(248,198,37,.25),transparent_75%)] text-accent">
            <Dumbbell size={23} strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{session.title}</p>
            <p className="mt-1 text-xs text-muted">
              {new Date(session.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              · {session.result.rep_count} reps ·{" "}
              {seconds(session.result.duration_s)}
            </p>
            {(session.result.model_choice || session.result.model) && (
              <p className="mt-1 truncate text-xs text-muted">
                {session.result.model_choice === "speed_only"
                  ? "Speed only"
                  : session.result.model_choice === "speed_shaking"
                    ? "Speed + shaking"
                    : (session.result.model?.display_name ??
                      session.result.model?.family ??
                      "Legacy model")}
              </p>
            )}
          </div>
        </button>
        <ArrowUpRight size={17} className="shrink-0 text-muted" aria-hidden="true" />
        <button
          aria-label={`Delete ${session.title}`}
          onClick={onToggleConfirm}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink"
        >
          <Trash2 size={17} />
        </button>
      </div>
      {confirming && (
        <div className="border-t border-line bg-soft p-4">
          <p className="mb-3 text-sm">
            {synced
              ? "Delete this result from your account and its video from this device?"
              : "Delete this saved video and result from this browser?"}
          </p>
          <div className="flex gap-2">
            <Button secondary onClick={onCancelConfirm}>
              Keep
            </Button>
            <Button onClick={onConfirmRemove}>Delete session</Button>
          </div>
        </div>
      )}
    </div>
  );
}
