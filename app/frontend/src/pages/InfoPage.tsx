import { Camera, Info, FlaskConical, ShieldCheck } from "lucide-react";
import { FilmingTips } from "../components/analyze/FilmingTips";

export function InfoPage() {
  return (
    <div className="animate-enter space-y-8">
      <div className="space-y-2">
        <p className="text-sm text-muted">Learn more</p>
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-.045em] sm:text-[40px]">
          About <span className="text-accent">RepLens.</span>
        </h1>
      </div>
      {/* What we analyze */}
      <section className="rounded-2xl border border-line bg-panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
            <Info size={16} />
          </span>
          <h2 className="text-sm font-semibold text-ink">What we analyze</h2>
        </div>
        <p className="text-sm leading-6 text-muted">
          Record or upload a set of simultaneous dumbbell curls. RepLens estimates
          how many complete reps you may have left — a measure of how close you
          are to your lifting limit.
        </p>
        <p className="text-sm leading-6 text-muted">
          RepLens tracks the speed and stability of your wrist movement across
          reps to predict your Reps In Reserve (RIR).
        </p>
      </section>
      {/* Filming tips */}
      <section className="rounded-2xl border border-line bg-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
            <Camera size={16} />
          </span>
          <h2 className="text-sm font-semibold text-ink">How to record</h2>
        </div>
        <FilmingTips />
      </section>
      {/* Research */}
      <section className="rounded-2xl border border-line bg-panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
            <FlaskConical size={16} />
          </span>
          <h2 className="text-sm font-semibold text-ink">Research & models</h2>
        </div>
        <p className="text-sm leading-6 text-muted">
          Speed plus shaking is selected by default. The model was trained on
          dumbbell curl sets and evaluated on held-out participants. Alternative
          prediction methods are available in the advanced options on the Predict page.
        </p>
      </section>
      {/* Disclaimer */}
      <section className="rounded-2xl border border-line bg-panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
            <ShieldCheck size={16} />
          </span>
          <h2 className="text-sm font-semibold text-ink">Important disclaimer</h2>
        </div>
        <p className="text-sm leading-6 text-muted">
          This is an experimental estimate, not a direct measurement of muscle
          fatigue. Analysis needs an internet connection when the server is
          hosted. Video is sent to the analyzer and its temporary copy is removed
          after processing.
        </p>
      </section>
      <footer className="pt-3 text-center text-[11px] text-muted">
        RepLens · A closer look at your effort.
      </footer>
    </div>
  );
}
