import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { LiveRepCounter, type LiveRepState } from "./repCounter";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type CameraState = "idle" | "starting" | "recording" | "stopping";

function recordingFormat() {
  const formats = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return formats.find((format) => MediaRecorder.isTypeSupported(format));
}

export function useLiveCamera(onRecorded: (file: File) => void) {
  const [state, setState] = useState<CameraState>("idle");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState("");
  const [repState, setRepState] = useState<LiveRepState>({
    count: 0,
    tracking: false,
    phase: "seeking_start",
    movement: "building",
  });
  const [elapsed, setElapsed] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const detector = useRef<PoseLandmarker | null>(null);
  const animation = useRef<number | null>(null);
  const startedAt = useRef(0);
  const lastSample = useRef(0);
  const lastElapsedUpdate = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const recordingFailed = useRef(false);
  const counter = useRef(new LiveRepCounter());
  const mounted = useRef(true);

  const release = useCallback(() => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    detector.current?.close();
    detector.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    };
  }, [release]);

  useEffect(() => {
    if (state === "idle") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  const stop = useCallback(() => {
    if (recorder.current?.state !== "recording") return;
    setState("stopping");
    recorder.current.stop();
    release();
  }, [release]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setState("starting");
    setError("");
    setElapsed(0);
    setRepState({ count: 0, tracking: false, phase: "seeking_start", movement: "building" });
    counter.current = new LiveRepCounter();
    chunks.current = [];
    recordingFailed.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("This browser does not support live camera recording.");
      }
      const format = recordingFormat();
      if (!format)
        throw new Error("This browser cannot record a supported video format.");

      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 960 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (!video.current) throw new Error("The camera preview is unavailable.");
      video.current.srcObject = media;
      await video.current.play();

      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      detector.current = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      if (!mounted.current) {
        release();
        return;
      }

      const mediaRecorder = new MediaRecorder(media, { mimeType: format });
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      mediaRecorder.onerror = () => {
        recordingFailed.current = true;
        if (mounted.current) setError("The recording stopped unexpectedly.");
        release();
        if (mounted.current) setState("idle");
      };
      mediaRecorder.onstop = () => {
        release();
        if (!mounted.current) return;
        if (recordingFailed.current) return;
        const blob = new Blob(chunks.current, { type: format });
        chunks.current = [];
        setState("idle");
        if (!blob.size) {
          setError("No video was recorded. Please try again.");
          return;
        }
        const extension = format.includes("mp4") ? "mp4" : "webm";
        onRecorded(
          new File([blob], `curl-set-${Date.now()}.${extension}`, {
            type: format,
          }),
        );
      };
      startedAt.current = performance.now();
      lastSample.current = 0;
      lastElapsedUpdate.current = 0;
      mediaRecorder.start(1000);
      setState("recording");

      const frame = (now: number) => {
        if (!mounted.current || recorder.current?.state !== "recording") return;
        const seconds = (now - startedAt.current) / 1000;
        if (now - lastElapsedUpdate.current >= 250) {
          lastElapsedUpdate.current = now;
          setElapsed(seconds);
        }
        if (seconds >= 180) {
          stop();
          return;
        }
        if (
          detector.current &&
          video.current &&
          video.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          now - lastSample.current >= 100
        ) {
          lastSample.current = now;
          try {
            const landmarks = detector.current.detectForVideo(
              video.current,
              now,
            ).landmarks[0];
            setRepState(counter.current.update(landmarks, now));
          } catch {
            setError(
              "Live tracking stopped. You can still finish the recording.",
            );
            detector.current?.close();
            detector.current = null;
          }
        }
        animation.current = requestAnimationFrame(frame);
      };
      animation.current = requestAnimationFrame(frame);
    } catch (cause) {
      release();
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not start the camera.",
        );
        setState("idle");
      }
    }
  }, [facing, onRecorded, release, state, stop]);

  return { video, state, facing, setFacing, error, repState, elapsed, start, stop, setError };
}
