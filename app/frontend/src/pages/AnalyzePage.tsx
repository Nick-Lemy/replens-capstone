import { VideoInput } from "../components/analyze/VideoInput";
import { AnalysisProgress } from "../components/analyze/AnalysisProgress";
import { FilmingTips } from "../components/analyze/FilmingTips";
import { ModelSelector } from "../components/analyze/ModelSelector";
import { Notice } from "../components/shared/UI";
import type { ModelChoice, ModelCatalog, AnalysisJob } from "../lib/types";

export function AnalyzePage({
  file,
  url,
  busy,
  job,
  onFile,
  onStart,
  onCancel,
  model,
  onModel,
  models,
  modelsLoading,
  modelsError,
  retryModels,
}: {
  file: File | null;
  url: string | null;
  busy: boolean;
  job?: AnalysisJob;
  onFile: (file: File | null) => void;
  onStart: () => void;
  onCancel: () => void;
  model: ModelChoice;
  onModel: (model: ModelChoice) => void;
  models?: ModelCatalog;
  modelsLoading: boolean;
  modelsError: boolean;
  retryModels: () => void;
}) {
  return (
    <div className="animate-enter space-y-7">
      <div className="space-y-2">
        <p className="text-sm text-muted">One set. A clearer picture.</p>
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-.045em] sm:text-[40px]">
          Predict muscle fatigue.
        </h1>
        <p className="max-w-md text-[15px] leading-6 text-muted">
          Record or upload a set of simultaneous dumbbell curls. RepLens
          estimates how many complete reps you may have left, a measure of how
          close you are to your lifting limit.
        </p>
      </div>
      {modelsLoading && (
        <p role="status" className="text-sm text-muted">
          Getting the analyzer ready…
        </p>
      )}
      {modelsError && (
        <Notice>
          The analyzer is unavailable.{" "}
          <button
            type="button"
            onClick={retryModels}
            className="font-medium underline"
          >
            Try again
          </button>
        </Notice>
      )}
      <VideoInput
        file={file}
        url={url}
        busy={busy}
        onFile={onFile}
        onStart={onStart}
        canStart={
          !modelsLoading &&
          !modelsError &&
          !!models?.models.find((item) => item.id === model && item.available)
        }
      />
      <AnalysisProgress busy={busy} job={job} onCancel={onCancel} />
      {!modelsLoading && !modelsError && (
        <details className="rounded-2xl border border-line bg-panel p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Advanced: compare prediction methods
          </summary>
          <p className="mt-3 text-xs leading-5 text-muted">
            Speed plus shaking is selected by default. These options support
            research comparisons and may produce different estimates.
          </p>
          <div className="mt-4">
            <ModelSelector
              value={model}
              onChange={onModel}
              catalog={models}
              loading={modelsLoading}
              error={modelsError}
              busy={busy}
              onRetry={retryModels}
            />
          </div>
        </details>
      )}
      {!modelsLoading && !modelsError &&
        !models?.models.some((item) => item.id === model && item.available) && (
          <Notice>
            The selected prediction method is unavailable. Open advanced
            options to choose an available method.
          </Notice>
        )}
      <FilmingTips />
      <p className="border-t border-line pt-5 text-xs leading-5 text-muted">
        This is an experimental estimate, not a direct measurement of muscle
        fatigue. Analysis needs an internet connection when the server is
        hosted. Video is sent to the analyzer and its temporary copy is removed
        after processing.
      </p>
    </div>
  );
}
