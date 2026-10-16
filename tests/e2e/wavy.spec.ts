import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { test, expect } from "@playwright/test";

const fixturePath = "tests/fixtures/sample.mp4";
const silentFixturePath = "tests/fixtures/sample-silent.mp4";
const hasMediaFixture = existsSync(fixturePath);

function expectValidAudioArtifact(outputPath: string, expectedCodec: string) {
  const metadata = JSON.parse(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels:format=duration",
    "-of", "json", outputPath,
  ], { encoding: "utf8" }));
  expect(metadata.streams[0].codec_name).toBe(expectedCodec);
  expect(metadata.streams[0].sample_rate).toBe("44100");
  expect(metadata.streams[0].channels).toBe(2);
  expect(Number(metadata.format.duration)).toBeGreaterThan(2);
  expect(Number(metadata.format.duration)).toBeLessThan(4);

  const analysis = spawnSync("ffmpeg", [
    "-hide_banner", "-i", outputPath, "-af", "volumedetect", "-f", "null", "-",
  ], { encoding: "utf8" });
  expect(analysis.status).toBe(0);
  const meanVolume = /mean_volume:\s*(-?[\d.]+) dB/.exec(analysis.stderr);
  expect(meanVolume).not.toBeNull();
  expect(Number(meanVolume?.[1])).toBeLessThan(-10);
}

async function waitForExtractionLink(page: import("@playwright/test").Page, format: "WAV" | "MP3") {
  const link = page.getByRole("link", { name: `Download ${format}` });
  const alert = page.getByRole("alert");
  await page.waitForFunction(() => {
    const card = document.querySelector(".extraction-card");
    return Boolean(card?.querySelector("a[download]") || card?.querySelector('[role="alert"]'));
  }, undefined, { timeout: 60_000 });
  if (await link.isVisible()) return link;
  throw new Error(`Extraction failed: ${await alert.innerText()}`);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("project settings autosave and survive reload", async ({ page }) => {
  const name = page.getByLabel("Project name");
  await name.fill("QA persistence project");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("wavy.studio-project.v1"))).toContain("QA persistence project");
  await page.reload();
  await expect(page.getByLabel("Project name")).toHaveValue("QA persistence project");
  await expect(page.getByText("1920 × 1080 · 30 FPS")).toBeVisible();
});

test("timeline supports moving and resizing overlay clips", async ({ page }) => {
  await page.getByRole("button", { name: "Add text overlay" }).click();
  const clip = page.locator(".studio-clip-overlay").last();
  await clip.click();
  const start = page.getByLabel("Start · seconds");
  const initialStart = Number(await start.inputValue());
  const box = await clip.boundingBox();
  if (!box) throw new Error("Overlay clip is not visible.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Number(await start.inputValue())).toBeGreaterThan(initialStart);

  const duration = page.getByLabel("Duration · seconds");
  const beforeResize = Number(await duration.inputValue());
  const handle = clip.locator(".studio-clip-resize");
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Clip resize handle is not visible.");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 60, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await duration.inputValue())).toBeGreaterThan(beforeResize);
});

test("lyric cue timestamp edits flow from the timeline into the lyric editor", async ({ page }) => {
  await page.locator("#lrc-input").setInputFiles({
    name: "qa-lyrics.lrc",
    mimeType: "text/plain",
    buffer: Buffer.from("[00:00.00]First lyric cue\n[00:02.00]Second lyric cue\n"),
  });
  const firstCue = page.locator(".studio-lyric-cue").filter({ hasText: "First lyric cue" });
  await expect(firstCue).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("1.25"));
  await firstCue.dblclick();
  await expect(page.getByLabel("Start time (ms)")).toHaveValue("1250");
});

test("project JSON exports and imports settings safely", async ({ page }) => {
  await page.getByLabel("Project name").fill("Round-trip QA");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Round-trip-QA.wavy.json");
  const path = await download.path();
  if (!path) throw new Error("Project download did not produce a file.");
  await page.getByLabel("Project name").fill("Temporary name");
  await page.locator('input[type="file"][accept*=".wavy.json"]').setInputFiles(path);
  await expect(page.getByLabel("Project name")).toHaveValue("Round-trip QA");
  await expect(page.getByRole("status").filter({ hasText: "Project settings and timeline imported" })).toBeVisible();
});

test("real video fixture extracts a valid WAV with audible samples", async ({ page }) => {
  test.skip(!hasMediaFixture, "CI generates a short MP4 fixture before running browser tests.");
  await page.locator("#audio-input").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "sample" })).toBeVisible();
  test.setTimeout(120_000);
  await page.getByRole("button", { name: "Extract audio to WAV" }).click();
  const downloadLink = await waitForExtractionLink(page, "WAV");
  const downloadPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadPromise;
  const outputPath = await download.path();
  if (!outputPath) throw new Error("WAV extraction did not create a downloadable file.");
  expectValidAudioArtifact(outputPath, "pcm_s16le");
});

test("real video fixture extracts a valid MP3 with audible samples", async ({ page }) => {
  test.skip(!hasMediaFixture, "CI generates a short MP4 fixture before running browser tests.");
  await page.locator("#audio-input").setInputFiles(fixturePath);
  await page.locator(".extractor-format select").selectOption("mp3");
  test.setTimeout(180_000);
  await page.getByRole("button", { name: "Extract audio to MP3" }).click();
  const downloadLink = await waitForExtractionLink(page, "MP3");
  const downloadPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadPromise;
  const outputPath = await download.path();
  if (!outputPath) throw new Error("MP3 extraction did not create a downloadable file.");
  expectValidAudioArtifact(outputPath, "mp3");
  await expect(page.getByRole("link", { name: "Download MP3" })).toBeVisible();
});

test("silent video reports a useful no-audio error", async ({ page }) => {
  test.skip(!existsSync(silentFixturePath), "CI generates a silent video fixture.");
  await page.locator("#audio-input").setInputFiles(silentFixturePath);
  await page.getByRole("button", { name: "Extract audio to WAV" }).click();
  await expect(page.getByRole("alert")).toContainText(/could not decode|no audio|audio stream/i, { timeout: 90_000 });
});

test("invalid video input fails safely instead of offering a broken download", async ({ page }) => {
  await page.locator("#audio-input").setInputFiles({
    name: "invalid.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("this is not a valid media container"),
  });
  await page.getByRole("button", { name: "Extract audio to WAV" }).click();
  await expect(page.getByRole("alert")).toContainText(/could not decode|invalid data|moov atom|error/i, { timeout: 90_000 });
  await expect(page.getByRole("link", { name: "Download WAV" })).toHaveCount(0);
});

test("conversion can be cancelled without modifying the source", async ({ page }) => {
  test.skip(!hasMediaFixture, "CI generates an MP4 fixture before running browser tests.");
  await page.locator("#audio-input").setInputFiles(fixturePath);
  await page.getByRole("button", { name: "Extract audio to WAV" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alert")).toContainText("Extraction cancelled");
  await expect(page.getByRole("button", { name: "Extract audio to WAV" })).toBeEnabled();
});
