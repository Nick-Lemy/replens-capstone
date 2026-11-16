import { test, expect } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_LIVE_API === "1";

test("live API journey reads current routes and handles an undecodable uploaded clip", async ({ page }) => {
  test.skip(!enabled, "run with PLAYWRIGHT_LIVE_API=1 and API_PROXY_TARGET pointed at a disposable local uvicorn");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /track muscle fatigue/i })).toBeVisible();
  await expect(page.getByText("Upload your curl set")).toBeVisible();
  await page.getByLabel("Choose a curl video").setInputFiles({
    name: "browser-smoke.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("synthetic undecodable browser smoke file"),
  });
  await expect(page.getByRole("button", { name: "Analyze set" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "Analyze set" }).click();
  await expect(page.getByText(/Analysis could not finish|could not finish|video|decode/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Analyze set" })).toBeVisible();
});

const privateClipPath = process.env.PLAYWRIGHT_REAL_CLIP;

test.describe("opt-in local research clip", () => {
  test("uploads a local clip through the real API and reaches results", async ({ page }) => {
    test.skip(!enabled || !privateClipPath, "set PLAYWRIGHT_LIVE_API=1 and PLAYWRIGHT_REAL_CLIP to a local clip; the clip is not copied into the worktree");
    test.setTimeout(300_000);
    await page.goto("/");
    await page.getByLabel("Choose a curl video").setInputFiles(privateClipPath!);
    await page.getByRole("button", { name: "Analyze set" }).click();
    await expect(page.getByRole("heading", { name: /your set review/i })).toBeVisible({ timeout: 280_000 });
    await expect(page.getByRole("heading", { name: "Explore each rep" })).toBeVisible();
  });
});
