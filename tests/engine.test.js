import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  terrain,
  random,
  cpuAim,
  predict,
  draftPool,
  launch,
  ballisticStep,
  GRAVITY,
  STEP,
} from "../src/engine.js";
import { WEAPONS } from "../src/weapons.js";
import { gamePacket } from "../src/network.js";
const step = (g, seconds) => {
  for (let i = 0; i < seconds * 120; i++) g.update(1 / 120);
};
const resolve = (g) => {
  for (let i = 0; i < 5000 && g.phase === "firing"; i++) g.update(1 / 120);
  assert.notEqual(g.phase, "firing", "weapon must resolve within 42 seconds");
};
function flat(options = {}) {
  const g = new Game({ seed: 42, kick: false, ...options });
  g.ground.fill(330);
  g.tanks.forEach((t) => {
    t.y = 326;
  });
  return g;
}
test("seeded terrain and weapon draft are reproducible, finite and bounded", () => {
  for (const type of ["mountain", "valley", "cliff", "plains"]) {
    assert.deepEqual(terrain(12, type), terrain(12, type));
    assert.ok(terrain(12, type).every((v) => v >= 105 && v <= 413));
  }
  assert.deepEqual(draftPool(100), draftPool(100));
  assert.equal(draftPool(100).length, 20);
  assert.notDeepEqual(draftPool(100), draftPool(101));
  const r = random(1);
  assert.ok(r() >= 0 && r() < 1);
});
test("circular craters remove dirt, leave distant ground and stop at bedrock", () => {
  const g = flat();
  g.crater(300, 330, 40);
  assert.equal(g.surface(300), 370);
  assert.equal(g.surface(250), 330);
  g.crater(300, 430, 90);
  assert.equal(g.surface(300), 440);
});
test("dirt buries tank and removal lets it fall; no automatic teleport onto new dirt", () => {
  const g = flat(),
    t = g.active;
  g.dirt(t.x, 330, 50);
  step(g, 0.5);
  assert.equal(t.y, 326);
  assert.equal(g.move(1), false);
  g.crater(t.x, 330, 70);
  step(g, 1);
  assert.ok(t.y > 326);
});
test("points reward enemy hits and penalize self hits without destroying tanks", () => {
  const g = flat(),
    a = g.tanks[0],
    b = g.tanks[1];
  g.score(0, b.x, b.y, 25, 60);
  assert.equal(a.score, 60);
  g.score(0, a.x, a.y, 25, 60);
  assert.equal(a.score, 0);
  assert.equal(g.tanks.length, 2);
});
test("movement uses four shared-match charges and rejects large cliffs", () => {
  const g = flat();
  for (let i = 0; i < 4; i++) {
    const x = g.active.x;
    assert.ok(g.move(1));
    assert.equal(g.active.x, x, "move must not teleport");
    assert.equal(g.fire("single"), false, "cannot fire in transit");
    assert.equal(g.move(1), false, "cannot spend another charge mid-move");
    step(g, 0.25);
    assert.ok(
      g.active.x > x && g.active.x < x + 25,
      "physical position advances during movement",
    );
    step(g, 0.5);
    assert.equal(g.active.x, x + 25);
    assert.equal(g.phase, "aiming");
  }
  assert.equal(g.active.moves, 0);
  assert.equal(g.move(-1), false);
  const h = flat();
  h.ground[115] = 150;
  assert.equal(h.move(1), false);
  assert.equal(h.active.moves, 4);
});
test("a fired weapon is consumed exactly once and turn changes only after resolution", () => {
  const g = flat({ inventories: [["single"], ["big"]] });
  assert.ok(g.fire("single"));
  assert.equal(g.fire("single"), false);
  assert.equal(g.active.inventory.length, 0);
  assert.equal(g.turn, 0);
  resolve(g);
  assert.equal(g.turn, 1);
  assert.equal(g.history.length, 1);
  assert.equal(g.history[0].weapon, "single");
});
test("ten volleys end only after both players fire ten times", () => {
  const g = flat({
    inventories: [Array(10).fill("single"), Array(10).fill("single")],
  });
  for (let i = 0; i < 20; i++) {
    assert.equal(g.phase, "aiming");
    g.aim(i % 2 ? 135 : 45, 50);
    assert.ok(g.fire("single"));
    resolve(g);
    if (i < 19) assert.equal(g.phase, "aiming");
  }
  assert.equal(g.phase, "finished");
  assert.deepEqual(
    g.tanks.map((t) => t.shots),
    [10, 10],
  );
  assert.equal(g.history.length, 20);
});
test("practice never consumes a weapon and supports more than ten volleys", () => {
  const g = flat({ practice: true, inventories: [["single"], ["single"]] });
  for (let i = 0; i < 22; i++) {
    g.fire("single");
    resolve(g);
  }
  assert.equal(g.phase, "aiming");
  assert.deepEqual(
    g.tanks.map((t) => t.inventory.length),
    [1, 1],
  );
});
test("all thirty weapons resolve with finite terrain and scores", () => {
  assert.equal(WEAPONS.length, 30);
  for (const w of WEAPONS) {
    const g = flat({ practice: true, inventories: [[w.id], [w.id]] });
    g.aim(43, 53);
    assert.ok(g.fire(w.id), w.id);
    resolve(g);
    assert.ok(
      g.ground.every((v) => Number.isFinite(v) && v >= 0 && v <= 440),
      w.id,
    );
    assert.ok(
      g.tanks.every(
        (t) =>
          Number.isFinite(t.score) &&
          Number.isFinite(t.x) &&
          Number.isFinite(t.y),
      ),
      w.id,
    );
  }
});
test("CPU predicts terrain-aware ballistic hits in either direction", () => {
  const g = flat();
  for (const side of [0, 1]) {
    g.turn = side;
    const a = cpuAim(g, "hard"),
      p = predict(g, g.active, a.angle, a.power);
    assert.ok(
      Math.abs(p.x - g.tanks[1 - side].x) < 35,
      JSON.stringify({ side, a, p }),
    );
  }
});
test("fast low shots cannot tunnel through terrain or tank collision", () => {
  const g = flat();
  g.tanks[1].x = 180;
  g.spawn("sniper", 130, 326, 3000, 0, { owner: 0 });
  g.phase = "firing";
  step(g, 0.04);
  assert.ok(g.tanks[0].score > 0);
});
test("terrain builders, excavators and spread weapons have different effects", () => {
  const wall = flat();
  wall.impact({ id: "wall", x: 400, y: 330, owner: 0 });
  step(wall, 1);
  assert.ok(wall.surface(400) < 200);
  const mover = flat();
  mover.aim(0, 40);
  mover.fire("mover");
  assert.ok(mover.surface(190) > 330);
  const scatter = flat();
  scatter.impact({ id: "scatter", x: 400, y: 330, owner: 0 });
  assert.equal(scatter.projectiles.length, 5);
  const hail = flat();
  hail.impact({ id: "hail", x: 400, y: 330, owner: 0 });
  assert.equal(hail.projectiles.length, 160);
});
test("burrowing shells travel through their own cleared tunnel", () => {
  const g = flat();
  g.impact({ id: "hog", x: 300, y: 330, vx: 120, vy: 0, owner: 0 });
  const p = g.projectiles[0];
  step(g, 0.5);
  assert.ok(
    g.projectiles.includes(p),
    "a tunnel must not count as exiting the original surface",
  );
  assert.ok(p.x > 330);
  assert.ok(g.surface(320) > 330);
});
test("liquid pellet damage is bounded after settling on flat ground", () => {
  for (const id of ["hail", "napalm"]) {
    const g = flat();
    g.impact({ id, x: g.tanks[1].x, y: 330, vx: 0, vy: 100, owner: 0 });
    g.phase = "firing";
    resolve(g);
    assert.ok(g.tanks[0].score < 800, `${id}: ${g.tanks[0].score}`);
  }
});

test("movement checks narrow obstacles along the entire path", () => {
  const g = flat();
  g.ground[103] = 260;
  assert.equal(g.move(1), false);
  assert.equal(g.active.moves, 4);
});
test("movement follows sloping ground continuously and stops at exact endpoint", () => {
  const g = flat();
  for (let x = 60; x < 140; x++) g.ground[x] = 330 - (x - 60) * 0.35;
  g.active.y = g.support(g.active.x);
  g.move(1);
  let previous = g.active.x,
    y = g.active.y;
  for (let i = 0; i < 100; i++) {
    g.update(STEP);
    assert.ok(g.active.x >= previous && g.active.x - previous < 1);
    assert.ok(Math.abs(g.active.y - y) < 1);
    assert.ok(Math.abs(g.active.y - g.support(g.active.x)) < 0.001);
    previous = g.active.x;
    y = g.active.y;
  }
  assert.equal(g.active.x, 115);
});
test("ballistic integration matches analytic gravity and wind at multiple frame rates", () => {
  for (const dt of [1 / 30, 1 / 60, STEP]) {
    const t = { x: 90, y: 326, angle: 51, power: 63 },
      start = launch(t),
      p = { ...start };
    for (let i = 0; i < Math.round(2 / dt); i++) ballisticStep(p, dt, 35);
    assert.ok(
      Math.abs(p.x - (start.x + start.vx * 2 + 0.5 * 35 * 0.18 * 4)) < 1e-8,
    );
    assert.ok(
      Math.abs(p.y - (start.y + start.vy * 2 + 0.5 * GRAVITY * 4)) < 1e-8,
    );
  }
});
test("prediction and actual first impact agree across wind, slopes, both tanks and downward angles", () => {
  for (const type of ["plains", "mountain", "cliff"])
    for (const wind of [-40, 0, 40])
      for (const side of [0, 1])
        for (const [angle, power] of [
          [0, 10],
          [28, 72],
          [51, 44],
          [90, 55],
          [135, 69],
          [180, 80],
          [270, 50],
          [350, 100],
        ]) {
          const g = new Game({
            seed: 17,
            type,
            wind,
            practice: true,
            kick: false,
          });
          g.turn = side;
          const predicted = predict(g, g.active, angle, power);
          let impact = null;
          g.impact = (p) => {
            impact = { x: p.x, y: p.y };
          };
          g.aim(angle, power);
          g.fire("single");
          for (let i = 0; i < 1700 && g.projectiles.length; i++) g.update(STEP);
          if (!predicted.out) {
            assert.ok(
              impact,
              JSON.stringify({ type, wind, side, angle, power, predicted }),
            );
            assert.ok(
              Math.hypot(impact.x - predicted.x, impact.y - predicted.y) < 1e-7,
            );
          } else
            assert.equal(
              impact,
              null,
              "out of arena prediction must match actual miss",
            );
        }
});
test("zero wind equal-height range and mirrored launch directions are symmetric", () => {
  const t = { x: 400, y: 300, power: 60 };
  const left = launch(t, 135),
    right = launch(t, 45);
  for (let i = 0; i < 200; i++) {
    ballisticStep(left, STEP, 0);
    ballisticStep(right, STEP, 0);
  }
  assert.ok(Math.abs(left.x + right.x - 800) < 1e-8);
  assert.ok(Math.abs(left.y - right.y) < 1e-8);
});

test("all weapon snapshots retain every particle and stay below the WebRTC message budget", () => {
  let largest = 0;
  for (const weapon of WEAPONS) {
    const g = flat({ practice: true });
    g.aim(45, 30);
    g.fire(weapon.id);
    for (let i = 0; i < 5000 && g.phase === "firing"; i++) {
      g.update(STEP);
      if (i % 10 !== 0) continue;
      const packet = gamePacket(g);
      const bytes = new TextEncoder().encode(JSON.stringify(packet)).length;
      largest = Math.max(largest, bytes);
      assert.ok(bytes < 48 * 1024, `${weapon.id}: ${bytes} bytes`);
      assert.equal(
        packet.projectiles.length,
        g.projectiles.length,
        "retain every rendered particle",
      );
      for (let j = 0; j < packet.projectiles.length; j++) {
        const p = packet.projectiles[j];
        assert.ok(
          Math.hypot(p.x - g.projectiles[j].x, p.y - g.projectiles[j].y) <
            0.008,
        );
        assert.equal(p.digGround, undefined);
        assert.equal(p.damage, undefined);
        assert.ok(p.trail.length <= 24);
      }
    }
  }
  assert.ok(largest > 15000, "exercise a substantial effect packet");
});
