import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  AnalysisResult,
  ReviewDraftRow,
  ReviewInterval,
  SetReview,
} from "../lib/types";

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

export function useSetReview(
  analysis: AnalysisResult,
  review: SetReview,
  onChange: (review: SetReview) => void,
) {
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
  return { edit, updateRow, submit, validation, mutation };
}
