import { VideoInput } from "../components/analyze/VideoInput";
import { AnalysisProgress } from "../components/analyze/AnalysisProgress";
import { FilmingTips } from "../components/analyze/FilmingTips";
import { ModelSelector } from "../components/analyze/ModelSelector";
import { Notice } from "../components/shared/UI";
import { LiveCamera } from "../components/analyze/LiveCamera";
import { useState } from "react";
import { ArrowUpRight, Camera, Dumbbell, ScanLine, Sparkles } from "lucide-react";
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
  onLiveActivityChange,
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
  onLiveActivityChange: (active: boolean) => void;
}) {
  const [liveOpen, setLiveOpen] = useState(false);

  return (
    <div className="animate-enter space-y-6">
      <div className="space-y-2">
        <p className="eyebrow">Your training companion</p>
        <h1 className="text-[34px] font-bold leading-[1.08] tracking-[-.055em] sm:text-[48px]">
          Know your set.<br /><span className="text-accent">Own your next rep.</span>
        </h1>
        <p className="max-w-lg text-sm leading-6 text-muted sm:text-[15px]">
          Record a set of simultaneous dumbbell curls and see how close you may
          be to your lifting limit, rep by rep.
        </p>
      </div>
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-stage p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-6 -top-6 size-48 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-40 w-2/3 bg-[radial-gradient(ellipse_at_bottom_right,rgba(248,198,37,.27),transparent_70%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/80"><Sparkles size={13} className="text-accent" /> Featured workout</span>
          <Dumbbell size={72} strokeWidth={1.1} className="rotate-[-22deg] text-white/30 sm:size-24" aria-hidden="true" />
        </div>
        <div className="relative mt-5">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-accent">Curl analysis</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-.04em] sm:text-3xl">Your effort, in focus.</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/65">Capture one complete set. Review your reps, pace, and fatigue-related estimate.</p>
          <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-accent"><ScanLine size={15} /> Video-based set review <ArrowUpRight size={14} /></div>
        </div>
      </section>
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
      {!file && !busy && !liveOpen && (
        <button
          type="button"
          className="surface-card group flex w-full items-center gap-4 px-5 py-5 text-left transition hover:border-accent/60 hover:bg-soft"
          onClick={() => setLiveOpen(true)}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink"><Camera size={21} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Open live camera</span>
            <span className="mt-1 block text-xs leading-5 text-muted">Count reps as you record, then analyze the completed set.</span>
          </span>
          <ArrowUpRight size={19} className="shrink-0 text-muted transition group-hover:text-accent" />
        </button>
      )}
      {liveOpen && (
        <LiveCamera
          onRecorded={onFile}
          onClose={() => setLiveOpen(false)}
          onActivityChange={onLiveActivityChange}
        />
      )}
      {!liveOpen && (
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
      )}
      <AnalysisProgress busy={busy} job={job} onCancel={onCancel} />
      {!modelsLoading && !modelsError && (
        <details className="surface-card p-5">
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
      {!modelsLoading &&
        !modelsError &&
        !models?.models.some((item) => item.id === model && item.available) && (
          <Notice>
            The selected prediction method is unavailable. Open advanced options
            to choose an available method.
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
