import { Camera, CircleDot, Square, SwitchCamera } from "lucide-react";
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
    <section className="space-y-4 rounded-2xl border border-line bg-panel p-3 sm:p-5">
      <div className="flex items-center justify-between gap-4 px-1">
        <h2 className="text-lg font-semibold tracking-tight">Live camera</h2>
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

      <div className="flex min-h-60 items-center justify-center overflow-hidden rounded-xl bg-stage">
        <video
          ref={camera.video}
          muted
          playsInline
          autoPlay
          className="block max-h-[65dvh] w-full object-contain"
          aria-label="Live camera preview"
        />
      </div>

      {active && (
        <div className="flex items-end justify-between gap-3 px-1" role="status">
          <div>
            <strong className="text-3xl tabular-nums">{camera.repState.count}</strong>
            <span className="ml-2 text-sm text-muted">reps</span>
          </div>
          <span className="flex items-center gap-1.5 pb-1 text-xs text-muted">
            <CircleDot size={13} className="text-red-400" />
            {seconds(camera.elapsed)}
          </span>
        </div>
      )}
      {active && !camera.repState.tracking && (
        <p className="px-1 text-xs text-muted">Keep both arms in view.</p>
      )}
      {camera.error && (
        <Notice onClose={() => camera.setError("")}>{camera.error}</Notice>
      )}
      {camera.state === "idle" && (
        <button
          type="button"
          onClick={() => camera.setFacing(camera.facing === "environment" ? "user" : "environment")}
          className="flex min-h-11 items-center gap-2 px-1 text-sm font-medium text-accent"
        >
          <SwitchCamera size={18} />
          Use {camera.facing === "environment" ? "front" : "rear"} camera
        </button>
      )}
      {camera.state === "idle" ? (
        <Button className="w-full" onClick={() => void camera.start()}>
          <Camera size={17} />
          Start recording
        </Button>
      ) : camera.state === "starting" ? (
        <Button className="w-full" busy>
          Starting camera…
        </Button>
      ) : camera.state === "stopping" ? (
        <Button className="w-full" busy>
          Saving video…
        </Button>
      ) : (
        <Button className="w-full" onClick={camera.stop}>
          <Square size={15} />
          Finish set
        </Button>
      )}
    </section>
  );
}
