import { Activity, CircleAlert } from "lucide-react";
import type { Rep } from "../../lib/types";

export function FatigueEstimate({ rep }: { rep: Rep | undefined }) {
  if (!rep || rep.rir === null) {
    return (
      <section className="rounded-2xl border border-line bg-panel p-5" role="status">
        <h2 className="text-sm font-medium">Fatigue-related estimate</h2>
        <p className="mt-2 text-sm text-muted">
          {rep?.prediction_status === "building_history"
            ? "The first three reps build movement history. An estimate can appear after rep 4."
            : "An estimate is unavailable for this rep. Check the video quality guidance above."}
        </p>
      </section>
    );
  }

  const nearLimit = rep.rir <= 2;

  return (
    <section className="rounded-2xl border border-line bg-panel p-5" role="status">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-soft">
          {nearLimit ? <CircleAlert size={18} /> : <Activity size={18} />}
        </span>
        <div>
          <h2 className="text-sm font-medium">Fatigue-related estimate</h2>
          <p className="mt-1 text-lg font-semibold">
            {nearLimit
              ? "Estimated near your lifting limit"
              : "Reps remaining estimated"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Based on predicted repetitions in reserve after rep {rep.rep}.
            This does not directly measure muscle fatigue or confirm that
            another rep is safe.
          </p>
        </div>
      </div>
    </section>
  );
}
