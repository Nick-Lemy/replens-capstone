import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../shared/UI";

type Sample = { processingMs: number; lagMs: number; pose: boolean; poseSampled: boolean; tracked: number };
type Result = { seconds: number; frames: number; skipped: number; poses: number; poseFound: number; tracked: number; medianMs: number; p95Ms: number; p95LagMs: number };

const DURATION_MS = 20_000;

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : 0;
}

export function ProcessingBenchmark() {
  const video = useRef<HTMLVideoElement>(null);
  const worker = useRef<Worker | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const frameCallback = useRef<number | null>(null);
  const busy = useRef(false);
  const samples = useRef<Sample[]>([]);
  const skipped = useRef(0);
  const started = useRef(0);
  const lastMediaTime = useRef(-1);
  const [phase, setPhase] = useState<"idle" | "loading" | "running">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const stop = useCallback(() => {
    if (video.current && frameCallback.current !== null && "cancelVideoFrameCallback" in video.current) {
      video.current.cancelVideoFrameCallback(frameCallback.current);
    }
    frameCallback.current = null;
    worker.current?.terminate();
    worker.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    busy.current = false;
    setPhase("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  const finish = useCallback(() => {
    const seconds = (performance.now() - started.current) / 1000;
    const measured = samples.current;
    setResult({
      seconds,
      frames: measured.length,
      skipped: skipped.current,
      poses: measured.filter((sample) => sample.poseSampled).length,
      poseFound: measured.filter((sample) => sample.pose).length,
      tracked: Math.round(measured.reduce((total, sample) => total + sample.tracked, 0) / Math.max(1, measured.length)),
      medianMs: percentile(measured.map((sample) => sample.processingMs), 0.5),
      p95Ms: percentile(measured.map((sample) => sample.processingMs), 0.95),
      p95LagMs: percentile(measured.map((sample) => sample.lagMs), 0.95),
    });
    stop();
  }, [stop]);

  const schedule = useCallback(() => {
    if (!video.current) return;
    frameCallback.current = video.current.requestVideoFrameCallback(async (_, metadata) => {
      if (performance.now() - started.current >= DURATION_MS) {
        finish();
        return;
      }
      schedule();
      if (busy.current || !worker.current || !video.current || metadata.mediaTime === lastMediaTime.current) {
        skipped.current++;
        return;
      }
      lastMediaTime.current = metadata.mediaTime;
      busy.current = true;
      try {
        const bitmap = await createImageBitmap(video.current);
        worker.current?.postMessage({ type: "frame", bitmap, timestamp: metadata.mediaTime * 1000, sentAt: performance.timeOrigin + performance.now() }, [bitmap]);
      } catch (cause) {
        busy.current = false;
        setError(cause instanceof Error ? cause.message : "Could not capture a frame.");
        stop();
      }
    });
  }, [finish, stop]);

  const start = useCallback(async () => {
    setResult(null);
    setError("");
    setPhase("loading");
    if (!HTMLVideoElement.prototype.requestVideoFrameCallback || !window.OffscreenCanvas || !window.createImageBitmap) {
      setError("This browser cannot run the frame processing benchmark.");
      setPhase("idle");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment", width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
      stream.current = media;
      if (!video.current) throw new Error("Camera preview is unavailable.");
      video.current.srcObject = media;
      await video.current.play();
      const processor = new Worker(new URL("../../features/live/processingBenchmark.worker.ts", import.meta.url), { type: "module" });
      worker.current = processor;
      processor.onmessage = (event: MessageEvent) => {
        if (event.data.type === "ready") {
          samples.current = [];
          skipped.current = 0;
          lastMediaTime.current = -1;
          started.current = performance.now();
          setPhase("running");
          schedule();
        } else if (event.data.type === "frame") {
          samples.current.push(event.data as Sample);
          busy.current = false;
        } else if (event.data.type === "error") {
          setError(event.data.message);
          stop();
        }
      };
      processor.onerror = () => {
        setError("Browser processing failed to start.");
        stop();
      };
      processor.postMessage({ type: "init" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the camera.");
      stop();
    }
  }, [schedule, stop]);

  return (
    <details className="surface-card p-5">
      <summary className="cursor-pointer text-sm font-semibold">Browser processing test</summary>
      <p className="mt-3 text-xs leading-5 text-muted">Measures pose detection and optical flow on camera frames for 20 seconds. This test does not predict RIR.</p>
      <video ref={video} muted playsInline className={`mt-3 w-full rounded-lg bg-stage ${phase === "idle" ? "hidden" : ""}`} aria-label="Processing test camera" />
      <div className="mt-3">
        {phase === "idle" ? <Button onClick={() => void start()}>Run 20-second test</Button> : phase === "loading" ? <Button busy>Loading processing models…</Button> : <Button onClick={finish}>Finish test</Button>}
      </div>
      {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
      {result && (
        <div className="mt-4 space-y-1 text-sm" role="status">
          <p>Processed motion frames: {result.frames} in {result.seconds.toFixed(1)} s ({(result.frames / result.seconds).toFixed(1)} fps)</p>
          <p>Skipped frames: {result.skipped}; pose checks: {result.poses} ({result.poseFound} with a pose)</p>
          <p>Processing time: median {result.medianMs.toFixed(0)} ms, 95th percentile {result.p95Ms.toFixed(0)} ms</p>
          <p>Frame delay, 95th percentile: {result.p95LagMs.toFixed(0)} ms; tracked points: {result.tracked} average</p>
          <p className="text-xs text-muted">A useful starting target is 25 motion fps, visible pose, and under 2 seconds delay. Optical flow here is a workload test, not the full server feature pipeline.</p>
        </div>
      )}
    </details>
  );
}
