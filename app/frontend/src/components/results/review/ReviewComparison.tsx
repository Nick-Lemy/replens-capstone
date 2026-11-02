import { roundedRir } from "../../../lib/display";
import type { AnalysisResult, SetReview } from "../../../lib/types";
export function ReviewComparison({
  result,
  analysis,
  onSeek,
}: {
  result: NonNullable<SetReview["result"]>;
  analysis: AnalysisResult;
  onSeek: (seconds: number) => void;
}) {
  return (
    <div aria-live="polite" className="space-y-2">
      <h3 className="text-sm font-medium">
        Observed and estimated reps remaining
      </h3>
      <p className="text-xs leading-5 text-muted">
        {result.notice} Model estimates are shown only for unchanged detected
        intervals.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 pr-2">Reviewed rep</th>
              <th className="py-2 pr-2">Observed</th>
              <th className="py-2">Model estimate</th>
            </tr>
          </thead>
          <tbody>
            {result.reps.map((r) => {
              const prediction = analysis.reps.find(
                (rep) => rep.rep === r.source_rep,
              );
              const unchanged =
                prediction &&
                prediction.start_s === r.start_s &&
                prediction.top_s === r.top_s &&
                prediction.end_s === r.end_s;
              return (
                <tr key={r.rep} className="border-b border-line">
                  <td className="py-2 pr-2">
                    <button
                      className="underline"
                      onClick={() => onSeek(r.start_s)}
                    >
                      {r.rep}
                    </button>
                    {r.source_rep != null
                      ? ` (detected ${r.source_rep})`
                      : " (added)"}
                  </td>
                  <td className="py-2 pr-2">{r.observed_rir}</td>
                  <td className="py-2">
                    {prediction && !unchanged
                      ? "Unavailable for edited interval"
                      : prediction?.rir != null
                        ? roundedRir(prediction.rir)
                        : "Unavailable"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
