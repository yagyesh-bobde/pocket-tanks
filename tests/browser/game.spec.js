import { test, expect } from "@playwright/test";
const state = (page) => page.evaluate(() => window.__review.state());
async function menu(page) {
  await page.goto("/?review=1");
  await page
    .getByRole("button", { name: "Click to Start", exact: true })
    .click();
}
async function setup(page, mode = "2 PLAYERS") {
  await menu(page);
  await page.getByRole("button", { name: mode, exact: true }).click();
  await page.getByLabel("Player 1 name").fill("Nova");
  await page.getByRole("button", { name: "Cyan", exact: true }).click();
  await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
  await page.getByLabel("Player 2 name").fill("Orbit");
  await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
}
test("local match: setup, draft, mouse/keyboard controls, pause, twenty shots, results and rematch", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await expect(
    page.getByRole("heading", { name: "WEAPON SHOP" }),
  ).toBeVisible();
  await page.locator("[data-pick]").first().click();
  await page.locator("[data-pick]").first().click();
  await expect(page.locator(".side-0 li")).toHaveCount(1);
  await expect(page.locator(".side-1 li")).toHaveCount(1);
  await page.getByRole("button", { name: "Random", exact: true }).click();
  expect((await state(page)).game.tanks.map((t) => t.inventory.length)).toEqual(
    [10, 10],
  );
  await page.locator("#angle").fill("50");
  await page.locator("#angle").press("Tab");
  await page.locator("#power").fill("60");
  await page.locator("#power").press("Tab");
  await page.locator("#scene").click({ position: { x: 300, y: 120 } });
  await page.keyboard.press("ArrowUp");
  expect((await state(page)).game.tanks[0].power).toBe(61);
  await page.getByLabel("Choose weapon", { exact: true }).click();
  await expect(page.locator(".arsenal-list button")).toHaveCount(10);
  await page.locator(".arsenal-list button").last().click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(
    page.getByRole("heading", { name: "HOW TO PLAY" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  for (let i = 0; i < 20; i++) {
    await expect(page.locator(".fire")).toBeEnabled();
    if (i === 0) {
      await page.keyboard.press("Space");
    } else {
      await page.locator(".fire").click();
    }
    await page.evaluate(() => window.__review.advance(35));
    if (i < 19)
      await expect
        .poll(async () => (await state(page)).game.phase)
        .toBe("aiming");
  }
  await expect.poll(async () => (await state(page)).screen).toBe("end");
  const end = (await state(page)).game;
  expect(end.tanks.map((t) => t.shots)).toEqual([10, 10]);
  expect(end.history).toHaveLength(20);
  await expect(page.getByText("TEN VOLLEYS COMPLETE")).toBeVisible();
  await page
    .getByRole("button", { name: "View shot-by-shot scorecard ↓" })
    .click();
  await expect(page.locator("#shot-log>div")).toHaveCount(20);
  await page
    .locator("#stage")
    .screenshot({ path: "docs/comparisons/end-state.png" });
  await page.getByRole("button", { name: "Play Again", exact: true }).click();
  expect((await state(page)).game.tanks.map((t) => t.shots)).toEqual([0, 0]);
  expect(errors).toEqual([]);
});
test("CPU takes its turn and saved local matches resume after reload", async ({
  page,
}) => {
  await setup(page, "1 PLAYER");
  await page.getByRole("button", { name: "Random", exact: true }).click();
  await page.locator(".fire").click();
  await page.evaluate(() => window.__review.advance(35));
  await expect
    .poll(async () => (await state(page)).game.history.length)
    .toBeGreaterThanOrEqual(1);
  await expect
    .poll(async () => (await state(page)).game.tanks[1].shots, {
      timeout: 8000,
    })
    .toBe(1);
  await page.evaluate(() => window.__review.advance(35));
  await expect.poll(async () => (await state(page)).game.turn).toBe(0);
  const before = (await state(page)).game;
  await page.reload();
  await page
    .getByRole("button", { name: "Click to Start", exact: true })
    .click();
  await page.getByRole("button", { name: "RESUME MATCH", exact: true }).click();
  const after = (await state(page)).game;
  expect(after.tanks.map((t) => t.shots)).toEqual(
    before.tanks.map((t) => t.shots),
  );
  expect(after.history).toHaveLength(2);
});
test("practice has the full arsenal, mobile controls fit and no shot consumes ammo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await menu(page);
  await page
    .getByRole("button", { name: "TARGET PRACTICE", exact: true })
    .click();
  expect((await state(page)).game.practice).toBe(true);
  await page.getByLabel("Choose weapon", { exact: true }).click();
  await expect(page.locator(".arsenal-list button")).toHaveCount(30);
  await page
    .locator(".arsenal-list button")
    .filter({ hasText: "Dirtball" })
    .click();
  await page.getByLabel("Touch increase power").click();
  await page.getByRole("button", { name: "FIRE", exact: true }).last().click();
  await page.evaluate(() => window.__review.advance(35));
  await expect.poll(async () => (await state(page)).game.phase).toBe("aiming");
  expect((await state(page)).game.tanks.map((t) => t.inventory.length)).toEqual(
    [30, 30],
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/comparisons/mobile.png",
    fullPage: true,
  });
});
