import { useState, type RefObject } from "react";
import { roundedRir } from "../../lib/display";
import type { AnalysisResult } from "../../lib/types";

export function ResultVideo({
  result,
  url,
  selected,
  setSelected,
  player,
}: {
  result: AnalysisResult;
  url: string | null;
  selected: number;
  setSelected: (i: number) => void;
  player: RefObject<HTMLVideoElement | null>;
}) {
  const [previewError, setPreviewError] = useState(false);
  const rep = result.reps[selected];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel p-2">
      <div className="relative overflow-hidden rounded-xl bg-stage">
        {!url ? (
          <p
            role="status"
            className="px-5 py-10 text-center text-sm leading-6 text-white"
          >
            This video is available only on the device where the session was
            saved. Your results are still shown below.
          </p>
        ) : (
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
        )}
        {previewError && (
          <p
            role="status"
            className="px-5 py-10 text-center text-sm leading-6 text-white"
          >
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
              <span className="text-base text-muted">
                {rep?.prediction_status === "building_history"
                  ? "Building history"
                  : "Unavailable"}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
