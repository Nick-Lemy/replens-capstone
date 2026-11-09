import { Activity, CircleAlert } from "lucide-react";
import type { Rep } from "../../lib/types";

export function FatigueEstimate({ rep }: { rep: Rep | undefined }) {
  if (!rep || rep.rir === null) {
    return (
      <section className="surface-card p-5" role="status">
        <h2 className="text-sm font-medium">Muscle fatigue estimate</h2>
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
    <section className="surface-card p-5" role="status">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
          {nearLimit ? <CircleAlert size={18} /> : <Activity size={18} />}
        </span>
        <div>
          <h2 className="text-sm font-medium">Muscle fatigue estimate</h2>
          <p className="mt-1 text-xl font-bold tracking-[-.03em]">
            {nearLimit
              ? "Estimated near your lifting limit"
              : "Reps remaining estimated"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Based on estimated reps remaining after rep {rep.rep}. Use this as
            guidance, not a guarantee that another rep is safe.
          </p>
        </div>
      </div>
    </section>
  );
}
