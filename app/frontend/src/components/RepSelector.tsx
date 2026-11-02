import { Play } from "lucide-react";
import type { AnalysisResult } from "../lib/types";
import { seconds } from "./UI";
export function RepSelector({
  result,
  selected,
  seek,
}: {
  result: AnalysisResult;
  selected: number;
  seek: (i: number) => void;
}) {
  const rep = result.reps[selected];
  return (
    <>
      {!!result.reps.length && (
        <section>
          <h2 className="mb-3 text-sm font-medium">Explore each rep</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {result.reps.map((r, i) => (
              <button
                key={r.rep}
                onClick={() => seek(i)}
                aria-pressed={i === selected}
                className={`min-h-12 min-w-14 shrink-0 rounded-xl border px-3 text-sm tabular-nums transition ${i === selected ? "border-ink bg-ink text-page" : "border-line bg-panel text-muted hover:text-ink"}`}
              >
                {r.rep}
              </button>
            ))}
          </div>
          {rep && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <Play size={12} />
              Rep {rep.rep} · {seconds(rep.start_s)}–{seconds(rep.end_s)}
            </p>
          )}
        </section>
      )}
    </>
  );
}
