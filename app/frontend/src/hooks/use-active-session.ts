import { useCallback, useRef, useState } from "react";
import type { AnalysisResult, SavedSession, SetReview } from "../lib/types";
import { initialReview } from "./use-set-review";
import { useHistory } from "./use-history";
export function useActiveSession() {
  const history = useHistory();
  const [session, setSession] = useState<SavedSession | null>(null);
  const [review, setReview] = useState<SetReview | null>(null);
  const [saved, setSaved] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const viewRef = useRef<string | null>(null);
  const reviewRef = useRef<SetReview | null>(null);
  const resetSave = history.save.reset;
  const open = useCallback(
    (next: SavedSession, isSaved = true) => {
      const id = crypto.randomUUID();
      viewRef.current = id;
      setViewId(id);
      const draft = next.review ?? initialReview(next.result);
      reviewRef.current = draft;
      setReview(draft);
      setSession(next);
      setSaved(isSaved);
      resetSave();
    },
    [resetSave],
  );
  const complete = useCallback(
    (result: AnalysisResult, video: Blob) => {
      open(
        {
          id: crypto.randomUUID(),
          title: "Dumbbell curl",
          createdAt: new Date().toISOString(),
          result,
          video,
        },
        false,
      );
    },
    [open],
  );
  function reset() {
    viewRef.current = null;
    reviewRef.current = null;
    setViewId(null);
    setSession(null);
    setReview(null);
    setSaved(false);
    history.save.reset();
  }
  function changeReview(next: SetReview) {
    reviewRef.current = next;
    setReview(next);
    setSaved(false);
  }
  async function save() {
    if (!session || !review || !viewId) return;
    const next = { ...session, review };
    const submittedView = viewId;
    try {
      await history.save.mutateAsync(next);
      if (viewRef.current === submittedView) {
        setSession(next);
        setSaved(reviewRef.current === review);
      }
    } catch {
      /* exposed by mutation */
    }
  }
  return {
    ...history,
    session,
    review,
    saved,
    viewId,
    open,
    complete,
    reset,
    changeReview,
    saveSession: save,
  };
}
