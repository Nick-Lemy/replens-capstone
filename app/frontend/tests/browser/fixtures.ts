import { expect, type Page } from "@playwright/test";

export const result = {
  model_choice: "speed_shaking",
  exercise: "simultaneous_dumbbell_curl",
  reps: [
    { rep: 1, start_s: 0.2, top_s: 0.6, end_s: 1, rir: null, prediction_status: "building_history", prediction_reason: null },
    { rep: 2, start_s: 1.1, top_s: 1.5, end_s: 1.9, rir: null, prediction_status: "building_history", prediction_reason: null },
    { rep: 3, start_s: 2, top_s: 2.4, end_s: 2.8, rir: null, prediction_status: "building_history", prediction_reason: null },
    { rep: 4, start_s: 2.9, top_s: 3.3, end_s: 3.7, rir: null, prediction_status: "unavailable", prediction_reason: "insufficient_tracking" },
  ],
  rep_count: 4,
  duration_s: 4,
  tracking_coverage: 0.82,
  warnings: [],
  prediction_unavailable_reason: "Tracking quality was insufficient for an estimate.",
  model: { family: "ridge_speed_shaking", display_name: "Speed + candidate shaking", version: "test", participant_mae_reps: 2.22, experimental: true, evaluation_examples: 33, evaluation_participants: 4 },
};

export async function installUiFixtures(page: Page, analysisResult = result) {
  let jobPolls = 0;
  let sessions: any[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");
    if (path === "/health") return route.fulfill({ json: { status: "ok", model_available: true } });
    if (path === "/models") return route.fulfill({ json: { default: "speed_shaking", models: [
      { id: "speed_only", display_name: "Speed only", family: "ridge", experimental: true, available: true },
      { id: "speed_shaking", display_name: "Speed + candidate shaking", family: "ridge", experimental: true, available: true },
    ] } });
    if (path === "/auth/status") return route.fulfill({ json: { enabled: true } });
    if (path === "/auth/me") return route.fulfill({ status: 401, json: { detail: "Not signed in" } });
    if (path === "/analyses" && request.method() === "POST") return route.fulfill({ status: 202, json: { id: "fixture-job" } });
    if (path === "/analyses/fixture-job" && request.method() === "GET") {
      jobPolls += 1;
      if (jobPolls === 1) return route.fulfill({ json: { id: "fixture-job", state: "processing", progress: 48, message: "Checking rep movement" } });
      return route.fulfill({ json: { id: "fixture-job", state: "completed", progress: 100, message: "Analysis complete", result: analysisResult } });
    }
    if (path === "/analyses/fixture-job" && request.method() === "DELETE") return route.fulfill({ status: 204 });
    if (path === "/sessions" && request.method() === "GET") return route.fulfill({ json: sessions });
    if (path === "/sessions" && request.method() === "POST") {
      const body = request.postDataJSON();
      sessions.unshift({ id: body.id, title: body.title, createdAt: new Date().toISOString(), result: body.result, review: body.review });
      return route.fulfill({ status: 204 });
    }
    if (path.startsWith("/sessions/") && request.method() === "DELETE") {
      sessions = sessions.filter((item) => item.id !== path.split("/").at(-1));
      return route.fulfill({ status: 204 });
    }
    if (path === "/auth/login" && request.method() === "POST") return route.fulfill({ json: { user: { id: 7, name: "Fixture Lifter", email: "lifter@example.test" } } });
    if (path === "/auth/forgot-password" && request.method() === "POST") return route.fulfill({ json: { message: "If an account matches, a reset link will be sent." } });
    if (path === "/auth/verify" && request.method() === "POST") return route.fulfill({ json: { user: { id: 7, name: "Fixture Lifter", email: "lifter@example.test" } } });
    if (path === "/auth/logout" && request.method() === "POST") return route.fulfill({ json: { message: "Signed out" } });
    return route.fulfill({ status: 404, json: { detail: `Unmocked fixture request: ${request.method()} ${path}` } });
  });
}

export async function chooseVideo(page: Page, name = "sample.mp4") {
  await page.getByLabel("Choose a curl video").setInputFiles({ name, mimeType: "video/mp4", buffer: Buffer.from("fixture video bytes") });
  await expect(page.getByText(name)).toBeVisible();
}
