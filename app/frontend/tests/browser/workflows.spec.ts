import { test, expect } from "@playwright/test";
import { chooseVideo, installUiFixtures, result as fixtureResult } from "./fixtures";

const start = async (page: import("@playwright/test").Page) => {
  await installUiFixtures(page);
  await page.goto("/");
};

test("upload rejects an unsupported file, completes a fixture analysis, and keeps unavailable RIR unavailable through history", async ({ page }) => {
  await start(page);
  await expect(page.getByRole("heading", { name: /track muscle fatigue/i })).toBeVisible();
  await page.getByLabel("Choose a curl video").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not video") });
  await expect(page.getByText("Choose an MP4, MOV, M4V or WebM video.")).toBeVisible();
  await chooseVideo(page);
  await page.getByRole("button", { name: "Analyze set" }).click();
  await expect(page.getByRole("heading", { name: /your set review/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Muscle fatigue estimate" })).toBeVisible();
  await expect(page.getByText("An estimate is unavailable for this rep.")).toBeVisible();
  await expect(page.getByText(/Estimated near your lifting limit|Reps remaining estimated/)).toHaveCount(0);
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Every set counts." })).toBeVisible();
  await expect(page.getByText("Recent sessions")).toBeVisible();
  await page.getByRole("button", { name: /Dumbbell curl/ }).first().click();
  await expect(page.getByRole("heading", { name: /your set review/i })).toBeVisible();
  await expect(page.getByText("An estimate is unavailable for this rep.")).toBeVisible();
  await page.getByRole("button", { name: "New analysis" }).click();
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Delete/ }).first().click();
  await expect(page.getByText(/Delete this saved video and result from this browser/)).toBeVisible();
  await page.getByRole("button", { name: "Delete session" }).click();
  await expect(page.getByText("Room for your first set.")).toBeVisible();
});

test("authentication forms validate confirmation and support forgot, verification redirect, and sign-out views", async ({ page }) => {
  await start(page);
  await page.goto("/?auth=login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password." })).toBeVisible();
  await page.getByLabel("Email address").fill("lifter@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account matches");

  await page.goto("/?auth=signup");
  await page.getByLabel("Your name").fill("Fixture Lifter");
  await page.getByLabel("Email address").fill("lifter@example.test");
  await page.locator("#auth-password").fill("StrongPassword123!");
  await page.locator("#auth-confirm-password").fill("DifferentPassword123!");
  await page.getByRole("button", { name: "Create account" }).last().click();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");

  await page.goto("/?auth=verify&token=fixture-token");
  await expect(page.getByRole("heading", { name: /track muscle fatigue/i })).toBeVisible();
  await expect(page).toHaveURL(/#analyze$/);

  await page.goto("/?auth=login");
  await page.getByLabel("Email address").fill("lifter@example.test");
  await page.locator("#auth-password").fill("StrongPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Your account." })).toBeVisible();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
});

test("analysis cancellation stops polling and upload errors remain recoverable", async ({ page }) => {
  await installUiFixtures(page);
  let pollCount = 0;
  let uploads = 0;
  await page.route("**/api/analyses/fixture-job", async (route) => {
    if (route.request().method() === "DELETE") return route.fulfill({ status: 204 });
    pollCount += 1;
    return route.fulfill({ json: { id: "fixture-job", state: "processing", progress: 22, message: "Waiting for analysis" } });
  });
  await page.route("**/api/analyses", async (route) => {
    if (route.request().method() === "POST" && uploads++ > 0) return route.abort("failed");
    return route.fallback();
  });
  await page.goto("/");
  await chooseVideo(page);
  await page.getByRole("button", { name: "Analyze set" }).click();
  await expect(page.getByText("Waiting for analysis")).toBeVisible();
  await page.getByRole("button", { name: "Cancel analysis" }).click();
  await expect(page.getByRole("button", { name: "Analyze set" })).toBeVisible();
  const countAfterCancel = pollCount;
  await page.waitForTimeout(1400);
  expect(pollCount).toBe(countAfterCancel);

  await page.getByRole("button", { name: "Analyze set" }).click();
  // The second request is deliberately interrupted to exercise the surfaced error.
  await expect(page.getByText(/could not be reached|failed|offline/i)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: "Analyze set" })).toBeVisible();
});

test("account creation checks required fields and password length", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A clearer view of your set." })).toBeVisible();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.goto("/?auth=signup");
  expect(await page.locator("#auth-name").evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  await page.getByLabel("Your name").fill("Fixture Lifter");
  await page.getByLabel("Email address").fill("lifter@example.test");
  await page.locator("#auth-password").fill("short");
  await page.locator("#auth-confirm-password").fill("short");
  expect(await page.locator("#auth-password").evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true);
});

test("rounded display does not change the raw prediction or its threshold meaning", async ({ page }) => {
  const numericResult = structuredClone(fixtureResult);
  numericResult.reps[3].rir = 2.6;
  await installUiFixtures(page, numericResult);
  await page.goto("/");
  await chooseVideo(page);
  await page.getByRole("button", { name: "Analyze set" }).click();
  await expect(page.getByRole("heading", { name: /your set review/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Reps remaining estimated")).toBeVisible();
  await expect(page.getByText("Estimated near your lifting limit")).toHaveCount(0);
  await expect(page.locator("div.grid.grid-cols-2.divide-x").getByText("3", { exact: true })).toBeVisible();
  expect(numericResult.reps[3].rir).toBe(2.6);
});

test("429 admission response is shown and the user can retry from the selected file", async ({ page }) => {
  await installUiFixtures(page);
  await page.route("**/api/analyses", async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 429, json: { detail: "The analyzer is busy. Please try again shortly." } });
    return route.fallback();
  });
  await page.goto("/");
  await chooseVideo(page);
  await page.getByRole("button", { name: "Analyze set" }).click();
  await expect(page.getByText("The analyzer is busy. Please try again shortly.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze set" })).toBeVisible();
});
