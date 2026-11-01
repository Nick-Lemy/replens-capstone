import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { roundedRir } from "../lib/display";
import type {
  AnalysisResult,
  ReviewDraftRow,
  ReviewInterval,
  SetReview,
} from "../lib/types";
import { Button, Notice } from "./ui";

export function initialReview(result: AnalysisResult): SetReview {
  return {
    draft: result.reps.map((r) => ({
      id: crypto.randomUUID(),
      included: true,
      start: String(r.start_s),
      top: String(r.top_s),
      end: String(r.end_s),
      sourceRep: r.rep,
    })),
    failureConfirmed: false,
    allRemainingVisible: false,
    result: null,
  };
}

export function SetReviewCard({
  analysis,
  review,
  onChange,
  onSeek,
}: {
  analysis: AnalysisResult;
  review: SetReview;
  onChange: (review: SetReview) => void;
  onSeek: (seconds: number) => void;
}) {
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  const [validation, setValidation] = useState("");
  const mutation = useMutation({ mutationFn: api.reviewSet });
  function edit(next: SetReview) {
    revision.current++;
    mutation.reset();
    setValidation("");
    onChange({ ...next, result: null });
  }
  function updateRow(id: string, changes: Partial<ReviewDraftRow>) {
    edit({
      ...review,
      draft: review.draft.map((row) =>
        row.id === id ? { ...row, ...changes } : row,
      ),
    });
  }
  async function submit() {
    if (!review.failureConfirmed || !review.allRemainingVisible) {
      setValidation("Confirm both statements before reviewing the set.");
      return;
    }
    const rows = review.draft.filter((row) => row.included);
    const reps: ReviewInterval[] = rows
      .map((row) => ({
        start_s: row.start.trim() === "" ? NaN : Number(row.start),
        top_s: row.top.trim() === "" ? NaN : Number(row.top),
        end_s: row.end.trim() === "" ? NaN : Number(row.end),
        source_rep: row.sourceRep,
      }))
      .sort((a, b) => a.start_s - b.start_s);
    if (
      reps.length < 1 ||
      reps.length > 200 ||
      reps.some(
        (r, i) =>
          ![r.start_s, r.top_s, r.end_s].every(Number.isFinite) ||
          r.start_s < 0 ||
          r.end_s > Math.min(analysis.duration_s, 180) ||
          !(r.start_s < r.top_s && r.top_s < r.end_s) ||
          (i > 0 && r.start_s < reps[i - 1].end_s),
      )
    ) {
      setValidation(
        "Include 1–200 reps in chronological order, without overlap. Each needs finite start, top and end times within the video, with start before top and top before end.",
      );
      return;
    }
    setValidation("");
    const submittedRevision = revision.current;
    try {
      const result = await mutation.mutateAsync(reps);
      if (submittedRevision === revision.current)
        onChange({ ...review, result });
    } catch {
      /* Mutation displays the server error. */
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-panel p-5">
      <div>
        <h2 className="text-sm font-medium">Review completed set</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          Review the full set in the video. Observed reps remaining are counted
          back from confirmed failure; model estimates remain separate.
        </p>
      </div>
      <details className="space-y-3">
        <summary className="cursor-pointer text-sm font-medium">
          Check and edit {review.draft.length} reps
        </summary>
        <div className="space-y-3">
          {review.draft.map((row, index) => (
            <div key={row.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={(e) =>
                      updateRow(row.id, { included: e.target.checked })
                    }
                  />
                  {row.sourceRep !== null
                    ? `Detected rep ${row.sourceRep}`
                    : `Added rep ${index + 1}`}
                </label>
                <div className="flex gap-3">
                  <button
                    className="text-xs underline"
                    onClick={() => {
                      const time = Number(row.start);
                      if (
                        row.start.trim() &&
                        Number.isFinite(time) &&
                        time >= 0 &&
                        time <= analysis.duration_s
                      )
                        onSeek(time);
                    }}
                  >
                    View
                  </button>
                  <button
                    className="text-xs underline"
                    onClick={() =>
                      edit({
                        ...review,
                        draft: review.draft.filter((r) => r.id !== row.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    ["start", "Start"],
                    ["top", "Top"],
                    ["end", "End"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="text-xs text-muted">
                    {label} (s)
                    <input
                      aria-label={`${label} seconds for ${row.sourceRep !== null ? `detected rep ${row.sourceRep}` : `added rep ${index + 1}`}`}
                      type="number"
                      min="0"
                      max={Math.min(analysis.duration_s, 180)}
                      step="any"
                      value={row[field]}
                      onChange={(e) =>
                        updateRow(row.id, { [field]: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-line bg-page px-2 py-2 text-sm text-ink"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          secondary
          onClick={() =>
            edit({
              ...review,
              draft: [
                ...review.draft,
                {
                  id: crypto.randomUUID(),
                  included: true,
                  start: "",
                  top: "",
                  end: "",
                  sourceRep: null,
                },
              ],
            })
          }
        >
          Add missing rep
        </Button>
      </details>
      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-2">
          <input
            className="mt-1"
            type="checkbox"
            checked={review.failureConfirmed}
            onChange={(e) =>
              edit({ ...review, failureConfirmed: e.target.checked })
            }
          />
          The lifter attempted another rep and could not complete it.
        </label>
        <label className="flex items-start gap-2">
          <input
            className="mt-1"
            type="checkbox"
            checked={review.allRemainingVisible}
            onChange={(e) =>
              edit({ ...review, allRemainingVisible: e.target.checked })
            }
          />
          No remaining full reps are omitted or edited out of the video.
        </label>
      </div>
      {(validation || mutation.error) && (
        <Notice>
          {validation ||
            (mutation.error instanceof Error
              ? mutation.error.message
              : "Review failed. Try again.")}
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void submit()}
          busy={mutation.isPending}
          disabled={mutation.isPending}
        >
          Calculate observed reps remaining
        </Button>
        <Button secondary onClick={() => edit(initialReview(analysis))}>
          Clear review
        </Button>
      </div>
      {review.result && (
        <ReviewComparison
          result={review.result}
          analysis={analysis}
          onSeek={onSeek}
        />
      )}
    </section>
  );
}

function ReviewComparison({
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
