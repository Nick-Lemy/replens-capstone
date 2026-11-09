import { VideoInput } from "../components/analyze/VideoInput";
import { AnalysisProgress } from "../components/analyze/AnalysisProgress";
import { Notice } from "../components/shared/UI";
import { LiveCamera } from "../components/analyze/LiveCamera";
import { useState } from "react";
import { ArrowUpRight, Camera, ScanLine } from "lucide-react";
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
  models,
  modelsLoading,
  modelsError,
  retryModels,
  onInfo,
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
  models?: ModelCatalog;
  modelsLoading: boolean;
  modelsError: boolean;
  retryModels: () => void;
  onInfo: () => void;
  onLiveActivityChange: (active: boolean) => void;
}) {
  const [liveOpen, setLiveOpen] = useState(false);

  return (
    <div className="animate-enter space-y-6">
      <h1 className="text-[30px] font-semibold leading-tight tracking-[-.035em] sm:text-[42px]">
        Track muscle fatigue<span className="text-accent">.</span>
      </h1>
      {!file && !busy && !liveOpen && (
        <section className="relative flex min-h-[210px] items-end overflow-hidden rounded-2xl border border-line bg-stage p-6 text-white sm:min-h-[270px] sm:p-8">
          <img
            src="/curl-hero.webp"
            alt="Athlete lifting dumbbells in a gym"
            className="absolute inset-0 size-full object-cover object-[65%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,11,14,.93)_0%,rgba(10,11,14,.79)_38%,rgba(10,11,14,.15)_100%)]" />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-[-.03em] sm:text-3xl">
              Review every rep.
            </h2>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("video-input")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
            >
              <ScanLine size={15} />
              Choose a video
              <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
      )}
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
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
            <Camera size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Open live camera</span>
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
      {!modelsLoading &&
        !modelsError &&
        !models?.models.some((item) => item.id === model && item.available) && (
          <Notice>
            The selected prediction method is unavailable.{" "}
            <button onClick={onInfo} className="font-semibold underline">
              Choose another in Info
            </button>
          </Notice>
        )}
    </div>
  );
}
