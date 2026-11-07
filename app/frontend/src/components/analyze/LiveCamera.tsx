import { Camera, CircleDot, ScanLine, Square } from "lucide-react";
import { useLiveCamera } from "../../features/live/useLiveCamera";
import { Button, Notice, seconds } from "../shared/UI";
import { useEffect } from "react";

export function LiveCamera({
  onRecorded,
  onClose,
  onActivityChange,
}: {
  onRecorded: (file: File) => void;
  onClose: () => void;
  onActivityChange: (active: boolean) => void;
}) {
  const camera = useLiveCamera((file) => {
    onRecorded(file);
    onClose();
  });
  const active = camera.state === "recording";

  useEffect(() => {
    onActivityChange(camera.state !== "idle");
    return () => onActivityChange(false);
  }, [camera.state, onActivityChange]);

  return (
    <section className="space-y-4 rounded-3xl border border-line bg-panel p-3 sm:p-5">
      <div className="flex items-start justify-between gap-4 px-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Live camera</h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            See a provisional rep count as you curl. Finish the set to analyze
            the recording.
          </p>
        </div>
        {camera.state === "idle" && (
          <button
            type="button"
            className="text-xs font-medium text-muted underline underline-offset-4"
            onClick={onClose}
          >
            Close
          </button>
        )}
      </div>

      <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-stage sm:aspect-video">
        <video
          ref={camera.video}
          muted
          playsInline
          autoPlay
          className="h-full w-full object-contain"
          aria-label="Live camera preview"
        />
        {active && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white">
            <CircleDot size={13} className="text-red-400" />
            Recording · {seconds(camera.elapsed)}
          </div>
        )}
        {active && (
          <div className="absolute bottom-3 left-3 rounded-2xl bg-black/80 px-4 py-3 text-white">
            <span className="block text-[11px] text-white/70">
              Provisional reps
            </span>
            <strong className="text-3xl tabular-nums">
              {camera.repState.count}
            </strong>
          </div>
        )}
      </div>

      {active && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs text-muted"
        >
          <ScanLine size={16} />
          {camera.repState.tracking
            ? "Both arms visible · count complete up-and-down curls"
            : "Keep both shoulders, elbows and wrists in view"}
        </div>
      )}
      {camera.error && (
        <Notice onClose={() => camera.setError("")}>{camera.error}</Notice>
      )}
      {camera.state === "idle" ? (
        <Button className="w-full" onClick={() => void camera.start()}>
          <Camera size={17} />
          Start recording
        </Button>
      ) : camera.state === "starting" ? (
        <Button className="w-full" busy>
          Starting camera and tracker
        </Button>
      ) : camera.state === "stopping" ? (
        <Button className="w-full" busy>
          Preparing recording
        </Button>
      ) : (
        <Button className="w-full" onClick={camera.stop}>
          <Square size={15} />
          Finish set
        </Button>
      )}
      <p className="px-1 text-xs leading-5 text-muted">
        Live counting is a preview and may miss reps. RIR is unavailable during
        recording. The completed video is checked by the server; review its rep
        count before using the result.
      </p>
    </section>
  );
}
