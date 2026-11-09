import { Camera, CircleHelp, ScanLine, ShieldCheck } from "lucide-react";
import { FilmingTips } from "../components/analyze/FilmingTips";
import { ProcessingBenchmark } from "../components/analyze/ProcessingBenchmark";
import { ModelSelector } from "../components/analyze/ModelSelector";
import type { ModelCatalog, ModelChoice } from "../lib/types";

type Props = {
  model: ModelChoice;
  onModel: (model: ModelChoice) => void;
  models?: ModelCatalog;
  modelsLoading: boolean;
  modelsError: boolean;
  retryModels: () => void;
  busy: boolean;
};

export function InfoPage({
  model,
  onModel,
  models,
  modelsLoading,
  modelsError,
  retryModels,
  busy,
}: Props) {
  return (
    <div className="animate-enter space-y-5">
      <div>
        <h1 className="text-[32px] font-semibold tracking-[-.035em] sm:text-[42px]">
          A clearer view of your set.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          RepLens estimates muscle fatigue during simultaneous dumbbell curls
          using the number of reps likely remaining after each clear rep.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: Camera,
            title: "Record",
            text: "Film one complete set with both arms visible.",
          },
          {
            icon: ScanLine,
            title: "Analyze",
            text: "The app detects reps and checks movement quality.",
          },
          {
            icon: ShieldCheck,
            title: "Review",
            text: "See estimates, confirm the count, and save the set.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <section key={title} className="surface-card p-5">
            <Icon size={23} strokeWidth={1.7} className="text-accent" />
            <h2 className="mt-4 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
          </section>
        ))}
      </div>

      <section className="surface-card p-5">
        <FilmingTips />
      </section>

      <section className="surface-card space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CircleHelp size={17} className="text-accent" />
          What the estimate means
        </div>
        <p className="text-sm leading-6 text-muted">
          Repetitions in reserve is an estimate of how many complete reps may
          remain. The first three reps build movement history. If tracking is
          unclear, RepLens shows that an estimate is unavailable.
        </p>
        <p className="text-sm leading-6 text-muted">
          The live camera counts reps and flags when recent reps take noticeably
          longer than early reps. RIR estimates appear after the recorded set is
          analyzed.
        </p>
        <p className="text-sm leading-6 text-muted">
          This is an indirect estimate based on movement, not a physiological
          measurement or a guarantee that another rep is safe.
        </p>
      </section>

      <details className="surface-card p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Prediction methods
        </summary>
        <p className="mt-3 text-xs leading-5 text-muted">
          Compare speed alone with speed plus candidate shaking. Both methods
          need a clear video and an internet connection for analysis.
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

      <ProcessingBenchmark />
    </div>
  );
}
