import type { AnalysisJob } from "../../lib/types";
export function AnalysisProgress({
  busy,
  job,
  onCancel,
}: {
  busy: boolean;
  job?: AnalysisJob;
  onCancel: () => void;
}) {
  return (
    <>
      {busy && (
        <section
          aria-live="polite"
          className="rounded-2xl border border-line bg-panel p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {job?.message ?? "Sending your video"}
              </p>
              <p className="mt-1 text-xs text-muted">
                You can keep this screen open while we work.
              </p>
            </div>
            {job && (
              <span className="font-mono text-xs tabular-nums text-muted">
                {job.progress}%
              </span>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Analysis progress"
            aria-valuenow={job?.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-soft"
          >
            <div
              className={`h-full rounded-full bg-ink transition-[width] duration-300 ${!job ? "w-1/3 animate-pulse" : ""}`}
              style={job ? { width: `${job.progress}%` } : undefined}
            />
          </div>
          {job && (
            <button
              onClick={onCancel}
              className="mt-4 text-xs text-muted underline underline-offset-4"
            >
              Cancel analysis
            </button>
          )}
        </section>
      )}
    </>
  );
}
