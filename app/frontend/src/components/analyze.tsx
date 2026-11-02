import { VideoInput } from "./video-input";
import { AnalysisProgress } from "./analysis-progress";
import { FilmingTips } from "./filming-tips";
import type { AnalysisJob } from "../lib/types";
export function Analyze({
  file,
  url,
  busy,
  job,
  onFile,
  onStart,
  onCancel,
}: {
  file: File | null;
  url: string | null;
  busy: boolean;
  job?: AnalysisJob;
  onFile: (file: File | null) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="animate-enter space-y-7">
      <div className="space-y-2">
        <p className="text-sm text-muted">One set. A closer look.</p>
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-.045em] sm:text-[40px]">
          See your set clearly.
        </h1>
        <p className="max-w-md text-[15px] leading-6 text-muted">
          Add a video of simultaneous dumbbell curls to explore your reps and
          estimated effort.
        </p>
      </div>
      <VideoInput
        file={file}
        url={url}
        busy={busy}
        onFile={onFile}
        onStart={onStart}
      />
      <AnalysisProgress busy={busy} job={job} onCancel={onCancel} />
      <FilmingTips />
      <p className="border-t border-line pt-5 text-xs leading-5 text-muted">
        Experimental research prototype. Estimates may be wrong. Analysis needs
        an internet connection when the server is hosted. Video is sent to the
        analyzer and its temporary copy is removed after processing.
      </p>
    </div>
  );
}
