import { test, expect } from "@playwright/test";
const state = (page) => page.evaluate(() => window.__review.state());
async function lobby(page, name) {
  await page.goto("/?review=1");
  await page.locator("[data-action=title]").first().click();
  if (name === "Nova") {
    await page.getByRole("button", { name: "OPTIONS", exact: true }).click();
    await page.locator("#terrain").selectOption("plains");
    await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "ONLINE / WI-FI", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill(name);
}
async function connect(a, b) {
  await lobby(a, "Nova");
  await lobby(b, "Orbit");
  await a.getByRole("button", { name: "CREATE ROOM", exact: true }).click();
  await expect
    .poll(async () => (await state(a)).network.status)
    .toBe("waiting");
  const code = (await state(a)).network.code;
  await b.getByLabel("Room code", { exact: true }).fill(code);
  await b.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
  await expect
    .poll(async () => (await state(a)).network.connected, { timeout: 20000 })
    .toBe(true);
  await expect
    .poll(async () => (await state(b)).network.connected, { timeout: 20000 })
    .toBe(true);
  return code;
}
test("two independent WebRTC clients draft, enforce turns, stream aim/movement, reconnect, finish and rematch", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage(),
    errors = [];
  a.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  try {
    const code = await connect(a, b);
    await a.getByRole("button", { name: "START MATCH", exact: true }).click();
    await expect(b.getByRole("heading", { name: "WEAPON SHOP" })).toBeVisible();
    await expect(b.locator("[data-pick]").first()).toBeDisabled();
    await a.locator("[data-pick]").first().click();
    await expect(b.locator("[data-pick]").first()).toBeEnabled();
    await b.locator("[data-pick]").first().click();
    await expect(a.locator(".side-1 li")).toHaveCount(1);
    await a.getByRole("button", { name: "Random", exact: true }).click();
    await expect(a.locator(".fire")).toBeEnabled();
    await expect(b.locator(".fire")).toBeDisabled();
    expect((await state(b)).game.tanks.map((t) => t.name)).toEqual([
      "Nova",
      "Orbit",
    ]);
    // The authority rejects guest fire and movement while the host owns the turn.
    await b.evaluate(() =>
      window.__review.networkCommand("fire", {
        weapon: "single",
        angle: 45,
        power: 50,
      }),
    );
    await b.evaluate(() => window.__review.networkCommand("move", { dir: 1 }));
    expect((await state(a)).game.tanks[1].shots).toBe(0);
    expect((await state(a)).game.tanks[0].moves).toBe(4);
    const x = (await state(a)).game.tanks[0].x;
    await a.getByRole("button", { name: "Move right", exact: true }).click();
    await expect.poll(async () => (await state(b)).game.phase).toBe("moving");
    const between = (await state(b)).game.tanks[0].x;
    expect(between).toBeGreaterThanOrEqual(x);
    expect(between).toBeLessThan(x + 25);
    await expect(a.locator(".fire")).toBeDisabled();
    await expect.poll(async () => (await state(b)).game.phase).toBe("aiming");
    expect((await state(b)).game.tanks[0].x).toBe(x + 25);
    await a.locator("#angle").fill("63");
    await a.locator("#power").fill("41");
    await expect
      .poll(async () => (await state(b)).game.tanks[0].angle)
      .toBe(63);
    await expect
      .poll(async () => (await state(b)).game.tanks[0].power)
      .toBe(41);
    await a.locator(".fire").click();
    await expect.poll(async () => (await state(b)).game.phase).toBe("firing");
    await a.evaluate(() => window.__review.advance(35));
    await expect(b.locator(".fire")).toBeEnabled();
    expect(await b.evaluate(() => window.__review.terrain())).toEqual(
      await a.evaluate(() =>
        window.__review.terrain().map((v) => Math.round(v * 100) / 100),
      ),
    );
    await expect(a.locator(".fire")).toBeDisabled();
    await b.locator("#angle").fill("133");
    await expect
      .poll(async () => (await state(a)).game.tanks[1].angle)
      .toBe(133);
    const guestX = (await state(b)).game.tanks[1].x;
    await b.getByRole("button", { name: "Move left", exact: true }).click();
    await expect.poll(async () => (await state(a)).game.phase).toBe("moving");
    await expect(b.locator(".fire")).toBeDisabled();
    await expect.poll(async () => (await state(b)).game.phase).toBe("aiming");
    expect((await state(a)).game.tanks[1].x).toBe(guestX - 25);
    // Drop the actual data channel, then reconnect from the original guest tab.
    await b.evaluate(() => window.__review.disconnect());
    await expect(
      a.getByRole("heading", { name: "CONNECTION LOST" }),
    ).toBeVisible();
    expect((await state(a)).network.code).toBe(code);
    await b.getByRole("button", { name: "RECONNECT", exact: true }).click();
    await expect
      .poll(async () => (await state(a)).network.connected, { timeout: 20000 })
      .toBe(true);
    await expect(b.locator(".fire")).toBeEnabled();
    expect((await state(b)).game.history).toHaveLength(1);
    // Check a complete host/guest match, including state and score agreement.
    for (let i = 1; i < 20; i++) {
      const current = i % 2 ? b : a;
      await expect(current.locator(".fire")).toBeEnabled();
      await current.locator(".fire").click();
      await expect.poll(async () => (await state(a)).game.phase).toBe("firing");
      await a.evaluate(() => window.__review.advance(35));
      await expect
        .poll(async () => (await state(b)).game.history.length)
        .toBe(i + 1);
    }
    await expect.poll(async () => (await state(a)).screen).toBe("end");
    await expect.poll(async () => (await state(b)).screen).toBe("end");
    expect((await state(b)).game.tanks.map((t) => t.score)).toEqual(
      (await state(a)).game.tanks.map((t) => t.score),
    );
    expect((await state(b)).game.tanks.map((t) => t.shots)).toEqual([10, 10]);
    await a.getByRole("button", { name: "Play Again", exact: true }).click();
    await expect(b.getByRole("heading", { name: "WEAPON SHOP" })).toBeVisible();
    await a.getByRole("button", { name: "Random", exact: true }).click();
    await expect(a.locator(".fire")).toBeEnabled();
    await expect.poll(async () => (await state(b)).game.tanks[1].shots).toBe(0);
    expect(errors).toEqual([]);
    await a.getByLabel("Pause match").click();
    await a.getByRole("button", { name: "MAIN MENU", exact: true }).click();
    await expect(
      b.getByRole("heading", { name: "CONNECTION LOST" }),
    ).toBeVisible();
  } finally {
    await ca.close();
    await cb.close();
  }
});
test("unknown code fails clearly and a third client cannot replace an occupied seat", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [a, b, c] = await Promise.all(contexts.map((x) => x.newPage()));
  try {
    await lobby(c, "Third");
    await c.getByLabel("Room code", { exact: true }).fill("ZZZZZZ");
    await c.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
    await expect
      .poll(async () => (await state(c)).network.status, { timeout: 20000 })
      .toBe("error");
    await expect(c.getByText(/Room not found/)).toBeVisible();
    const code = await connect(a, b);
    await c.getByRole("button", { name: "Leave room", exact: false }).click();
    await c
      .getByRole("button", { name: "ONLINE / WI-FI", exact: true })
      .click();
    await c.getByLabel("Room code", { exact: true }).fill(code);
    await c.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
    await expect
      .poll(async () => (await state(c)).network.reason)
      .toContain("already has two players");
    expect((await state(a)).network.connected).toBe(true);
    expect((await state(b)).network.connected).toBe(true);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
