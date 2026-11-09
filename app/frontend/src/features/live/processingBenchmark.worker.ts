import cv from "@techstark/opencv-js";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let detector: PoseLandmarker | null = null;
let canvas: OffscreenCanvas;
let context: OffscreenCanvasRenderingContext2D;
let previous: cv.Mat | null = null;
let lastPoseAt = -Infinity;

async function initialize() {
  await cv;
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  detector = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  canvas = new OffscreenCanvas(640, 480);
  const value = canvas.getContext("2d", { willReadFrequently: true });
  if (!value) throw new Error("Offscreen canvas is unavailable.");
  context = value;
  postMessage({ type: "ready" });
}

function opticalFlow(current: cv.Mat) {
  if (!previous) return 0;

  const points = new cv.Mat();
  const next = new cv.Mat();
  const status = new cv.Mat();
  const error = new cv.Mat();
  const back = new cv.Mat();
  const backStatus = new cv.Mat();
  const backError = new cv.Mat();

  try {
    cv.goodFeaturesToTrack(previous, points, 360, 0.02, 8);
    if (points.rows < 5) return 0;
    const window = new cv.Size(21, 21);
    cv.calcOpticalFlowPyrLK(previous, current, points, next, status, error, window, 3);
    cv.calcOpticalFlowPyrLK(current, previous, next, back, backStatus, backError, window, 3);
    let tracked = 0;
    for (let i = 0; i < points.rows; i++) {
      const dx = points.data32F[i * 2] - back.data32F[i * 2];
      const dy = points.data32F[i * 2 + 1] - back.data32F[i * 2 + 1];
      if (status.data[i] && backStatus.data[i] && dx * dx + dy * dy < 1) tracked++;
    }
    return tracked;
  } finally {
    points.delete();
    next.delete();
    status.delete();
    error.delete();
    back.delete();
    backStatus.delete();
    backError.delete();
  }
}

function process(bitmap: ImageBitmap, timestamp: number, sentAt: number) {
  const start = performance.now();
  try {
    const scale = Math.min(640 / bitmap.width, 480 / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      previous?.delete();
      previous = null;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const rgba = cv.matFromImageData(context.getImageData(0, 0, width, height));
    const gray = new cv.Mat();
    try {
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
      const tracked = opticalFlow(gray);
      previous?.delete();
      previous = gray.clone();
      let pose = false;
      if (timestamp - lastPoseAt >= 100 && detector) {
        pose = detector.detectForVideo(bitmap, timestamp).landmarks.length > 0;
        lastPoseAt = timestamp;
      }
      postMessage({
        type: "frame",
        processingMs: performance.now() - start,
        lagMs: performance.timeOrigin + performance.now() - sentAt,
        pose,
        poseSampled: timestamp === lastPoseAt,
        tracked,
      });
    } finally {
      rgba.delete();
      gray.delete();
    }
  } catch (cause) {
    postMessage({ type: "error", message: cause instanceof Error ? cause.message : "Processing failed." });
  } finally {
    bitmap.close();
  }
}

self.onmessage = (event: MessageEvent) => {
  if (event.data.type === "init") {
    void initialize().catch((cause) => {
      postMessage({ type: "error", message: cause instanceof Error ? cause.message : "Could not initialize processing." });
    });
  } else if (event.data.type === "frame") {
    process(event.data.bitmap, event.data.timestamp, event.data.sentAt);
  }
};
