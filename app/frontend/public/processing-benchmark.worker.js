const FLOW_URL = "/jsfeat-min.js";
const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/vision_bundle.mjs";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let detector;
let canvas;
let context;
let previous = null;
let lastPoseAt = -Infinity;
let corners = [];

async function initialize() {
  postMessage({ type: "stage", message: "Loading optical flow…" });
  self.window = self;
  importScripts(FLOW_URL);
  postMessage({ type: "stage", message: "Loading pose model…" });
  const { FilesetResolver, PoseLandmarker } = await import(VISION_URL);
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  detector = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  canvas = new OffscreenCanvas(640, 480);
  context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Offscreen canvas is unavailable.");
  postMessage({ type: "ready" });
}

function opticalFlow(current) {
  if (!previous) return 0;
  jsfeat.fast_corners.set_threshold(20);
  const detected = jsfeat.fast_corners.detect(previous.data[0], corners, 12);
  const count = Math.min(360, detected);
  if (count < 5) return 0;
  const points = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const corner = corners[Math.floor((i * detected) / count)];
    points[i * 2] = corner.x;
    points[i * 2 + 1] = corner.y;
  }
  const next = new Float32Array(count * 2);
  const forwardStatus = new Uint8Array(count);
  const back = new Float32Array(count * 2);
  const backStatus = new Uint8Array(count);
  jsfeat.optical_flow_lk.track(previous, current, points, next, count, 21, 30, forwardStatus);
  jsfeat.optical_flow_lk.track(current, previous, next, back, count, 21, 30, backStatus);
  let tracked = 0;
  for (let i = 0; i < count; i++) {
    const dx = points[i * 2] - back[i * 2];
    const dy = points[i * 2 + 1] - back[i * 2 + 1];
    if (forwardStatus[i] && backStatus[i] && dx * dx + dy * dy < 1) tracked++;
  }
  return tracked;
}

function process(bitmap, timestamp, sentAt) {
  const start = performance.now();
  try {
    const scale = Math.min(640 / bitmap.width, 480 / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      previous = null;
      corners = Array.from({ length: width * height }, () => new jsfeat.keypoint_t());
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    const gray = new jsfeat.matrix_t(width, height, jsfeat.U8_t | jsfeat.C1_t);
    jsfeat.imgproc.grayscale(image.data, width, height, gray);
    const current = new jsfeat.pyramid_t(4);
    current.allocate(width, height, jsfeat.U8_t | jsfeat.C1_t);
    current.data[0].data.set(gray.data);
    current.build(current.data[0]);
    const flowStart = performance.now();
    const tracked = opticalFlow(current);
    const flowMs = performance.now() - flowStart;
    previous = current;
    let pose = false;
    let poseSampled = false;
    let poseMs = 0;
    if (timestamp - lastPoseAt >= 100) {
      const poseStart = performance.now();
      pose = detector.detectForVideo(bitmap, timestamp).landmarks.length > 0;
      poseMs = performance.now() - poseStart;
      poseSampled = true;
      lastPoseAt = timestamp;
    }
    postMessage({
      type: "frame",
      processingMs: performance.now() - start,
      lagMs: performance.timeOrigin + performance.now() - sentAt,
      pose,
      poseSampled,
      tracked,
      flowMs,
      poseMs,
    });
  } catch (cause) {
    postMessage({ type: "error", message: cause instanceof Error ? cause.message : "Processing failed." });
  } finally {
    bitmap.close();
  }
}

self.onmessage = (event) => {
  if (event.data.type === "init") {
    initialize().catch((cause) => {
      postMessage({ type: "error", message: cause instanceof Error ? cause.message : "Could not initialize processing." });
    });
  } else if (event.data.type === "frame") {
    process(event.data.bitmap, event.data.timestamp, event.data.sentAt);
  }
};
