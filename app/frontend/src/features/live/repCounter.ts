import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

type Phase = "seeking_start" | "lifting" | "lowering";

export type LiveRepState = {
  count: number;
  tracking: boolean;
  phase: Phase;
};

function bend(points: NormalizedLandmark[], side: "left" | "right") {
  const [shoulderIndex, elbowIndex, wristIndex] =
    side === "left" ? [11, 13, 15] : [12, 14, 16];
  const [shoulder, elbow, wrist] = [
    points[shoulderIndex],
    points[elbowIndex],
    points[wristIndex],
  ];

  if (
    !shoulder ||
    !elbow ||
    !wrist ||
    [shoulder, elbow, wrist].some((point) => (point.visibility ?? 1) < 0.6)
  ) {
    return null;
  }

  const upper = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const lower = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
  const denominator =
    Math.hypot(upper.x, upper.y) * Math.hypot(lower.x, lower.y);
  if (denominator < 0.005) return null;

  const cosine = Math.max(
    -1,
    Math.min(1, (upper.x * lower.x + upper.y * lower.y) / denominator),
  );
  return 180 - (Math.acos(cosine) * 180) / Math.PI;
}

export class LiveRepCounter {
  private phase: Phase = "seeking_start";
  private count = 0;
  private phaseSince = 0;
  private lastVisible = 0;

  update(
    points: NormalizedLandmark[] | undefined,
    timestamp: number,
  ): LiveRepState {
    const left = points ? bend(points, "left") : null;
    const right = points ? bend(points, "right") : null;
    const tracking = left !== null && right !== null;

    if (!tracking) {
      if (timestamp - this.lastVisible > 750) {
        this.phase = "seeking_start";
      }
      return { count: this.count, tracking: false, phase: this.phase };
    }

    this.lastVisible = timestamp;
    const extended = left < 55 && right < 55;
    const curled = left > 90 && right > 90;

    if (this.phase === "seeking_start" && extended) {
      this.phase = "lifting";
      this.phaseSince = timestamp;
    } else if (
      this.phase === "lifting" &&
      curled &&
      timestamp - this.phaseSince >= 200
    ) {
      this.phase = "lowering";
    } else if (this.phase === "lowering" && extended) {
      if (
        timestamp - this.phaseSince >= 650 &&
        timestamp - this.phaseSince < 12000
      ) {
        this.count++;
      }
      this.phase = "lifting";
      this.phaseSince = timestamp;
    }

    if (timestamp - this.phaseSince > 12000) {
      this.phase = extended ? "lifting" : "seeking_start";
      this.phaseSince = timestamp;
    }

    return { count: this.count, tracking: true, phase: this.phase };
  }
}
