import { roundedRir } from "../lib/display";
import type { AnalysisResult } from "../lib/types";
export function PredictionChart({
  result,
  selected,
}: {
  result: AnalysisResult;
  selected: number;
}) {
  const valid = result.reps.filter((r) => r.rir !== null);
  const maxY = Math.max(5, ...valid.map((r) => roundedRir(r.rir!)));
  const x = (i: number) => 15 + (i / Math.max(1, result.reps.length - 1)) * 310;
  const y = (v: number) => 125 - (roundedRir(v) / maxY) * 100;
  return (
    <>
      {!!valid.length && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Estimated reps remaining</h2>
            <span className="text-xs text-muted">Tap a rep</span>
          </div>
          <svg
            viewBox="0 0 340 150"
            className="mt-4 w-full overflow-visible"
            aria-label="Estimated reps remaining per completed repetition"
            role="img"
          >
            <line x1="15" y1="125" x2="325" y2="125" className="stroke-line" />
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line
                  x1="15"
                  x2="325"
                  y1={y(maxY * f)}
                  y2={y(maxY * f)}
                  className="stroke-line"
                  strokeDasharray="2 5"
                />
                <text
                  x="15"
                  y={y(maxY * f) - 5}
                  className="fill-muted text-[9px]"
                >
                  {(maxY * f).toFixed(0)}
                </text>
              </g>
            ))}
            {result.reps
              .slice(1)
              .map((r, i) =>
                r.rir !== null && result.reps[i].rir !== null ? (
                  <line
                    key={r.rep}
                    x1={x(i)}
                    y1={y(result.reps[i].rir!)}
                    x2={x(i + 1)}
                    y2={y(r.rir)}
                    className="stroke-ink"
                    strokeWidth="1.5"
                  />
                ) : null,
              )}
            {result.reps.map(
              (r, i) =>
                r.rir !== null && (
                  <circle
                    key={r.rep}
                    cx={x(i)}
                    cy={y(r.rir)}
                    r={i === selected ? 4.5 : 3}
                    className="fill-ink"
                  />
                ),
            )}
            <text x="15" y="145" className="fill-muted text-[10px]">
              Rep 1
            </text>
            <text
              x="325"
              y="145"
              textAnchor="end"
              className="fill-muted text-[10px]"
            >
              Rep {result.rep_count}
            </text>
          </svg>
          <p className="mt-3 text-xs leading-5 text-muted">
            Display estimates are rounded to nonnegative whole numbers. Raw
            predictions are retained in the saved result.
          </p>
        </section>
      )}
    </>
  );
}
