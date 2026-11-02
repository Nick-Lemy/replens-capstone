import { useRef, useState } from "react";
import { Bookmark, Check, Play, RotateCcw, ChevronLeft } from "lucide-react";
import { roundedRir } from "../lib/display";
import type { AnalysisResult, SetReview } from "../lib/types";
import { SetReviewCard } from "./set-review";
import { Button, Notice, seconds } from "./ui";
export function Results({
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
  const [previewError, setPreviewError] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  const rep = result.reps[selected];
  const valid = result.reps.filter((r) => r.rir !== null);
  const maxY = Math.max(5, ...valid.map((r) => roundedRir(r.rir!)));
  const x = (i: number) => 15 + (i / Math.max(1, result.reps.length - 1)) * 310;
  const y = (v: number) => 125 - (roundedRir(v) / maxY) * 100;
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
      <div className="overflow-hidden rounded-3xl border border-line bg-panel p-2">
        <div className="relative overflow-hidden rounded-[18px] bg-stage">
          <video
            ref={player}
            src={url ?? undefined}
            controls
            playsInline
                muted
            className={previewError ? "hidden" : "mx-auto max-h-95 w-full"}
            onError={() => setPreviewError(true)}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              const index = result.reps.findIndex(
                (r) => t >= r.start_s && t <= r.end_s,
              );
              if (index >= 0) setSelected(index);
            }}
          />
          {previewError && (
            <p role="status" className="px-5 py-10 text-center text-sm leading-6 text-white">
              Your browser cannot play this video format. The analysis is still
              available below. Use an H.264 MP4 for browser playback.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 divide-x divide-line px-2 py-5">
          <div className="px-3">
            <p className="text-xs text-muted">Detected reps</p>
            <p className="mt-2 text-4xl font-medium tracking-tight tabular-nums">
              {result.rep_count}
            </p>
          </div>
          <div className="px-5">
            <p className="text-xs text-muted">
              Estimated reps left{rep ? ` · rep ${rep.rep}` : ""}
            </p>
            <p className="mt-2 text-4xl font-medium tracking-tight tabular-nums">
              {rep?.rir != null ? (
                roundedRir(rep.rir)
              ) : (
                <span className="text-base text-muted">{rep?.prediction_status === "building_history" ? "Building history" : "Unavailable"}</span>
              )}
            </p>
          </div>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted">Estimates can start after rep 4 when movement is clear enough to measure. The first three reps build history.</p>
      {rep?.prediction_reason && (
        <Notice>Tracking was not clear enough for an estimate at this rep. Keep both wrists visible and use a steady camera.</Notice>
      )}
    {result.prediction_unavailable_reason && (
        <Notice>{result.prediction_unavailable_reason}</Notice>
      )}
      {!!valid.length && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Estimated reps remaining</h2>
            <span className="text-xs text-muted">Tap a rep</span>
          </div>
          <svg
            viewBox="0 0 340 150"
            className="mt-4 w-full overflow-visible"
            aria-label="Estimated reps remaining per completed repetition"
            role="img"
          >
            <line x1="15" y1="125" x2="325" y2="125" className="stroke-line" />
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line
                  x1="15"
                  x2="325"
                  y1={y(maxY * f)}
                  y2={y(maxY * f)}
                  className="stroke-line"
                  strokeDasharray="2 5"
                />
                <text
                  x="15"
                  y={y(maxY * f) - 5}
                  className="fill-muted text-[9px]"
                >
                  {(maxY * f).toFixed(0)}
                </text>
              </g>
            ))}
            {result.reps
              .slice(1)
              .map((r, i) =>
                r.rir !== null && result.reps[i].rir !== null ? (
                  <line
                    key={r.rep}
                    x1={x(i)}
                    y1={y(result.reps[i].rir!)}
                    x2={x(i + 1)}
                    y2={y(r.rir)}
                    className="stroke-ink"
                    strokeWidth="1.5"
                  />
                ) : null,
              )}
            {result.reps.map(
              (r, i) =>
                r.rir !== null && (
                  <circle
                    key={r.rep}
                    cx={x(i)}
                    cy={y(r.rir)}
                    r={i === selected ? 4.5 : 3}
                    className="fill-ink"
                  />
                ),
            )}
            <text x="15" y="145" className="fill-muted text-[10px]">
              Rep 1
            </text>
            <text
              x="325"
              y="145"
              textAnchor="end"
              className="fill-muted text-[10px]"
            >
              Rep {result.rep_count}
            </text>
          </svg>
          <p className="mt-3 text-xs leading-5 text-muted">
            Display estimates are rounded to nonnegative whole numbers. Raw predictions
            are retained in the saved result.
          </p>
        </section>
      )}
      {!!result.reps.length && (
        <section>
          <h2 className="mb-3 text-sm font-medium">Explore each rep</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {result.reps.map((r, i) => (
              <button
                key={r.rep}
                onClick={() => seek(i)}
                aria-pressed={i === selected}
                className={`min-h-12 min-w-14 shrink-0 rounded-xl border px-3 text-sm tabular-nums transition ${i === selected ? "border-ink bg-ink text-page" : "border-line bg-panel text-muted hover:text-ink"}`}
              >
                {r.rep}
              </button>
            ))}
          </div>
          {rep && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <Play size={12} />
              Rep {rep.rep} · {seconds(rep.start_s)}–{seconds(rep.end_s)}
            </p>
          )}
        </section>
      )}
      <SetReviewCard analysis={result} review={review} onChange={onReviewChange} onSeek={(time) => { if (player.current) { player.current.currentTime = time; void player.current.play().catch(() => {}); } }} />
      <div className="space-y-2 text-xs leading-5 text-muted">
        {result.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
        {result.model && (
          <p>
            {result.model.display_name ?? result.model.family.toUpperCase()} · {result.model.version} ·
            Experimental model. Held-out participant average error:{" "}
            {result.model.participant_mae_reps.toFixed(2)} reps
            {result.model.evaluation_examples && result.model.evaluation_participants
              ? ` on ${result.model.evaluation_examples} quality-filtered examples from ${result.model.evaluation_participants} people`
              : ""}. This is not an individual confidence estimate.
            {result.model.evaluated_refit === false && " The app uses a refit on all accepted training examples; that refit has not been independently evaluated."}
          </p>
        )}
        <p>
          Predictions do not confirm muscle failure or tell you that another rep
          is safe.
        </p>
      </div>
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
