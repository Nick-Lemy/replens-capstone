import { useRef, useState } from "react";
import { Bookmark, Check, RotateCcw, ChevronLeft } from "lucide-react";
import { ResultVideo } from "../components/results/ResultVideo";
import { PredictionChart } from "../components/results/PredictionChart";
import { RepSelector } from "../components/results/RepSelector";
import { ModelMetadata } from "../components/results/ModelMetadata";
import type { AnalysisResult, SetReview } from "../lib/types";
import { SetReviewCard } from "../components/results/review/SetReviewCard";
import { Button, Notice, seconds } from "../components/shared/UI";
export function ResultsPage({
  result,
  url,
  onBack,
  onSave,
  saved,
  saving,
  review,
  onReviewChange,
}: {
  result: AnalysisResult;
  url: string | null;
  onBack: () => void;
  onSave?: () => void;
  saved: boolean;
  saving: boolean;
  review: SetReview;
  onReviewChange: (review: SetReview) => void;
}) {
  const [selected, setSelected] = useState(Math.max(0, result.reps.length - 1));
  const player = useRef<HTMLVideoElement>(null);
  const rep = result.reps[selected];
  function seek(i: number) {
    setSelected(i);
    if (player.current) {
      player.current.currentTime = result.reps[i].start_s;
      void player.current.play().catch(() => {});
    }
  }
  return (
    <div className="animate-enter space-y-6">
      <button
        onClick={onBack}
        className="flex min-h-10 items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft size={16} />
        Analyze
      </button>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-sm text-muted">Your set, in focus</p>
          <h1 className="text-3xl font-semibold tracking-[-.04em]">
            Set review
          </h1>
        </div>
        <span className="pb-1 text-xs text-muted">
          {seconds(result.duration_s)}
        </span>
      </div>
      <ResultVideo
        result={result}
        url={url}
        selected={selected}
        setSelected={setSelected}
        player={player}
      />
      <p className="text-xs leading-5 text-muted">
        Estimates can start after rep 4 when movement is clear enough to
        measure. The first three reps build history.
      </p>
      {rep?.prediction_reason && (
        <Notice>
          Tracking was not clear enough for an estimate at this rep. Keep both
          wrists visible and use a steady camera.
        </Notice>
      )}
      {result.prediction_unavailable_reason && (
        <Notice>{result.prediction_unavailable_reason}</Notice>
      )}
      <PredictionChart result={result} selected={selected} />
      <RepSelector result={result} selected={selected} seek={seek} />
      <SetReviewCard
        analysis={result}
        review={review}
        onChange={onReviewChange}
        onSeek={(time) => {
          if (player.current) {
            player.current.currentTime = time;
            void player.current.play().catch(() => {});
          }
        }}
      />
      <ModelMetadata result={result} />
      <div className="grid grid-cols-2 gap-3">
        <Button secondary onClick={onBack}>
          <RotateCcw size={15} />
          New analysis
        </Button>
        <Button onClick={onSave} disabled={saved || !onSave} busy={saving}>
          {saved ? <Check size={16} /> : <Bookmark size={16} />}
          {saved ? "Saved" : "Save session"}
        </Button>
      </div>
      <p className="text-center text-xs text-muted">
        Saved sessions and their videos stay in this browser.
      </p>
    </div>
  );
}
