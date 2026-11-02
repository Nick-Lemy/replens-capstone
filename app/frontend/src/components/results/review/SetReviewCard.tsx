import { ReviewRepRow } from "./ReviewRepRow";
import { initialReview, useSetReview } from "../../../hooks/useSetReview";
import { ReviewComparison } from "./ReviewComparison";
import type { AnalysisResult, SetReview } from "../../../lib/types";
import { Button, Notice } from "../../shared/UI";

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
  const { edit, updateRow, submit, validation, mutation } = useSetReview(
    analysis,
    review,
    onChange,
  );

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
            <ReviewRepRow
              key={row.id}
              row={row}
              index={index}
              duration={analysis.duration_s}
              onSeek={onSeek}
              updateRow={updateRow}
              onRemove={() =>
                edit({
                  ...review,
                  draft: review.draft.filter((r) => r.id !== row.id),
                })
              }
            />
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
