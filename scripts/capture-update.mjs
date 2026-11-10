import { chromium } from "@playwright/test";
import { mkdir, writeFile, mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const out = "docs/updates";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const videoDir = await mkdtemp(join(tmpdir(), "pocket-update-"));
const context = await browser.newContext({
  viewport: { width: 824, height: 702 },
  recordVideo: {
    dir: videoDir,
    size: { width: 824, height: 702 },
  },
});
const page = await context.newPage();
const states = [];
await page.goto("http://127.0.0.1:5180/?review=1");
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => window.__review.scene("spider-impact"));
await page.locator("#stage").screenshot({ path: `${out}/battle-after.png` });
await page.goto("http://127.0.0.1:5180/?review=1");
await page.locator("[data-action=title]").first().click();
await page.locator("[data-action=options]").click();
await page.locator("#terrain").selectOption("plains");
await page.locator("[data-action=save-options]").click();
await page.locator("[data-mode=practice]").click();
await page.locator("#stage").screenshot({ path: `${out}/move-before.png` });
await page.locator('[data-move="1"]').click();
await page.waitForFunction(() => window.__review.state().game.tanks[0].x >= 99);
states.push(await page.evaluate(() => window.__review.state()));
await page.locator("#stage").screenshot({ path: `${out}/move-during.png` });
await page.waitForFunction(
  () => window.__review.state().game.phase === "aiming",
);
await page.locator("#stage").screenshot({ path: `${out}/move-after.png` });
const wheel = await page.locator("#hud [data-angle-wheel]").boundingBox();
await page.mouse.move(wheel.x + 20, wheel.y + 10);
await page.mouse.down();
await page.mouse.move(wheel.x + 80, wheel.y + 10, { steps: 25 });
states.push(await page.evaluate(() => window.__review.state()));
await page.locator("#stage").screenshot({ path: `${out}/live-aim.png` });
await page.mouse.up();
await page.locator("#angle").fill("45");
await page.locator("#power").fill("48");
await page.locator(".fire").click();
await page.waitForFunction(
  () => window.__review.state().game.turn === 1,
  null,
  { timeout: 20000 },
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${out}/mobile.png`, fullPage: true });
const video = page.video();
await context.close();
await cp(await video.path(), `${out}/movement-aiming.webm`);
await rm(videoDir, { recursive: true, force: true });
const a = await browser.newPage({ viewport: { width: 824, height: 702 } }),
  b = await browser.newPage({ viewport: { width: 824, height: 702 } });
for (const [p, name] of [
  [a, "Nova"],
  [b, "Orbit"],
]) {
  await p.goto("http://127.0.0.1:5180/?review=1");
  await p.locator("[data-action=title]").first().click();
  await p.locator("[data-action=network]").click();
  await p.locator("#network-name").fill(name);
}
await a.locator("[data-action=host-room]").click();
await a.waitForFunction(
  () => window.__review.state().network.status === "waiting",
  null,
  { timeout: 25000 },
);
const code = await a.evaluate(() => window.__review.state().network.code);
await a.locator("#stage").screenshot({ path: `${out}/room-host.png` });
await b.locator("#room-code").fill(code);
await b.locator("[data-action=join-room]").click();
await b.waitForFunction(() => window.__review.state().network.connected, null, {
  timeout: 30000,
});
await a.locator("[data-action=start-online]").click();
await b.waitForFunction(() => window.__review.state().screen === "draft");
await a.locator("[data-action=random]").click();
await b.waitForFunction(() => window.__review.state().screen === "battle");
await a.locator("#angle").fill("53");
await a.locator("#power").fill("48");
await b.waitForFunction(
  () => window.__review.state().game.tanks[0].angle === 53,
);
await a.locator("#stage").screenshot({ path: `${out}/network-host.png` });
await b.locator("#stage").screenshot({ path: `${out}/network-guest.png` });
states.push(
  await a.evaluate(() => window.__review.state()),
  await b.evaluate(() => window.__review.state()),
);
await writeFile(`${out}/capture-state.json`, JSON.stringify(states, null, 2));
await browser.close();
console.log(
  "Captured live movement, aiming, mobile and public-broker two-client screenshots.",
);
