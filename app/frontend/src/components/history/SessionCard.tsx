import { Film, Trash2 } from "lucide-react";
import type { SavedSession } from "../../lib/types";
import { Button, seconds } from "../shared/UI";
export function SessionCard({
  session,
  confirming,
  onOpen,
  onToggleConfirm,
  onCancelConfirm,
  onConfirmRemove,
}: {
  session: SavedSession;
  confirming: boolean;
  onOpen: (session: SavedSession) => void;
  onToggleConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmRemove: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => onOpen(session)}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-soft">
            <Film size={20} strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{session.title}</p>
            <p className="mt-1 text-xs text-muted">
              {new Date(session.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              · {session.result.rep_count} reps · {seconds(session.result.duration_s)}
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
            Delete this saved video and result from this browser?
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
