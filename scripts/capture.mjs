import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const out = process.argv[2] ?? "docs/comparisons/final";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 824, height: 702 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:5180/?review=1");
await page.evaluate(() => document.fonts.ready);
for (const [file, scene] of [
  ["titlescreen", "title"],
  ["player1", "setup"],
  ["weaponshop", "draft"],
  ["spider", "spider-impact"],
  ["hailstorm", "hail-impact"],
  ["tommygun", "tommy-impact"],
]) {
  await page.evaluate((scene) => window.__review.scene(scene), scene);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#stage").screenshot({ path: `${out}/${file}.png` });
  console.log(`Captured ${file}: ${scene}`);
}
await browser.close();
