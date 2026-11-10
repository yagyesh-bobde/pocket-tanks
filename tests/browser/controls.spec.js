import { test, expect } from "@playwright/test";
const state = (page) => page.evaluate(() => window.__review.state());
async function practice(page) {
  await page.goto("/?review=1");
  await page.locator("[data-action=title]").first().click();
  await page
    .getByRole("button", { name: "TARGET PRACTICE", exact: true })
    .click();
}
test("angle thumbwheel, scroll, live number edits and battlefield drag update without losing capture", async ({
  page,
}) => {
  await practice(page);
  const picker = page.getByRole("slider", {
    name: "Drag angle picker",
    exact: true,
  });
  const box = await picker.boundingBox();
  const angle = (await state(page)).game.tanks[0].angle;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2, {
    steps: 8,
  });
  const during = (await state(page)).game.tanks[0].angle;
  expect(during).toBeGreaterThan(angle);
  expect(await picker.evaluate((el) => el.hasPointerCapture(1))).toBe(true);
  await page.mouse.move(box.x + box.width + 35, box.y + box.height / 2, {
    steps: 6,
  });
  expect((await state(page)).game.tanks[0].angle).toBeGreaterThan(during);
  await page.mouse.up();
  await picker.hover();
  const beforeScroll = (await state(page)).game.tanks[0].angle;
  await page.mouse.wheel(0, 24);
  await expect
    .poll(async () => (await state(page)).game.tanks[0].angle)
    .toBe(beforeScroll + 2);
  await page.locator("#angle").fill("123");
  expect((await state(page)).game.tanks[0].angle).toBe(123); // No blur/change required.
  await page.locator("#power").fill("37");
  expect((await state(page)).game.tanks[0].power).toBe(37);
  await picker.focus();
  await page.keyboard.press("ArrowRight");
  expect((await state(page)).game.tanks[0].angle).toBe(124);
  await page.locator("#angle").fill("359");
  await picker.focus();
  await page.keyboard.press("ArrowRight");
  expect((await state(page)).game.tanks[0].angle).toBe(0);
  const canvas = await page.locator("#scene").boundingBox();
  await page.mouse.move(
    canvas.x + canvas.width * 0.45,
    canvas.y + canvas.height * 0.3,
  );
  await page.mouse.down();
  const a = (await state(page)).game.tanks[0].angle;
  await page.mouse.move(
    canvas.x + canvas.width * 0.6,
    canvas.y + canvas.height * 0.2,
    { steps: 5 },
  );
  expect((await state(page)).game.tanks[0].angle).not.toBe(a);
  await page.mouse.up();
});
test("tank actually travels between positions, blocks fire while moving and arrives at destination", async ({
  page,
}) => {
  await page.goto("/?review=1");
  await page.locator("[data-action=title]").first().click();
  await page.getByRole("button", { name: "OPTIONS", exact: true }).click();
  await page.locator("#terrain").selectOption("plains");
  await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
  await page
    .getByRole("button", { name: "TARGET PRACTICE", exact: true })
    .click();
  const start = (await state(page)).game.tanks[0].x;
  await page.getByRole("button", { name: "Move right", exact: true }).click();
  await expect.poll(async () => (await state(page)).game.phase).toBe("moving");
  const mid = (await state(page)).game.tanks[0].x;
  expect(mid).toBeGreaterThanOrEqual(start);
  expect(mid).toBeLessThan(start + 25);
  await expect(page.locator(".fire")).toBeDisabled();
  await expect.poll(async () => (await state(page)).game.phase).toBe("aiming");
  expect((await state(page)).game.tanks[0].x).toBe(start + 25);
  expect((await state(page)).game.tanks[0].moves).toBe(3);
});
test("mobile angle scrubber receives touch pointer updates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await practice(page);
  const el = page.getByRole("slider", {
    name: "Touch angle picker",
    exact: true,
  });
  const b = await el.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + 20, y: b.y + 20 }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: b.x + 20 + (50 * i) / 8, y: b.y + 20 }],
    });
  await expect
    .poll(async () => (await state(page)).game.tanks[0].angle)
    .toBe(70);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(b.width).toBeGreaterThan(150);
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
