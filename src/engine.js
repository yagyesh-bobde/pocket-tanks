import { WEAPONS, weaponById } from "./weapons.js";
export const WIDTH = 800,
  SKY = 450,
  GRAVITY = 110,
  STEP = 1 / 120,
  BARREL = 16;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// Screen y points down; angles are absolute, counterclockwise from the right.
export function launch(tank, angle = tank.angle, power = tank.power) {
  const a = (angle * Math.PI) / 180,
    speed = clamp(power, 0, 100) * 5.1;
  return {
    x: tank.x + Math.cos(a) * BARREL,
    y: tank.y - 5 - Math.sin(a) * BARREL,
    vx: Math.cos(a) * speed,
    vy: -Math.sin(a) * speed,
  };
}
export function ballisticStep(p, dt, wind, gravity = GRAVITY) {
  // Exact constant-acceleration integration, shared by prediction and live fire.
  p.x += p.vx * dt + 0.5 * wind * 0.18 * dt * dt;
  p.y += p.vy * dt + 0.5 * gravity * dt * dt;
  p.vx += wind * 0.18 * dt;
  p.vy += gravity * dt;
}
export function sweep(game, p, x0, y0) {
  const n =
    Math.ceil(Math.max(Math.abs(p.x - x0), Math.abs(p.y - y0)) / 2) || 1;
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((p.x - x0) * i) / n,
      y = y0 + ((p.y - y0) * i) / n;
    if (x < 0 || x > 799 || y > 455) return { x, y, out: true };
    const tank = game.tanks.findIndex(
      (t, j) =>
        (j !== p.owner || p.age > 0.22) && Math.hypot(x - t.x, y - t.y) < 8,
    );
    if ((y >= 0 && y >= game.surface(x)) || tank >= 0) return { x, y, tank };
  }
  return null;
}
export function random(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function terrain(seed = 1, type = "mountain") {
  const rng = random(seed),
    points = [];
  const count = type === "plains" ? 12 : 26;
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * 799;
    let y;
    if (type === "valley") y = 200 + 180 * Math.sin((i / count) * Math.PI);
    else if (type === "cliff") y = i / count < 0.57 ? 155 : 370;
    else if (type === "plains") y = 310;
    else
      y =
        300 -
        125 * Math.sin((i / count) * Math.PI) +
        45 * Math.sin((i / count) * Math.PI * 3 + seed);
    points.push({ x, y: y + (rng() - 0.5) * (type === "plains" ? 18 : 60) });
  }
  return Float64Array.from({ length: WIDTH }, (_, x) => {
    let i = Math.min(count - 1, Math.floor((x / 799) * count));
    let t = (x - points[i].x) / (points[i + 1].x - points[i].x);
    t = t * t * (3 - 2 * t);
    return clamp(
      points[i].y * (1 - t) + points[i + 1].y * t + Math.sin(x * 0.16) * 1.2,
      105,
      413,
    );
  });
}
export function draftPool(seed) {
  const rng = random(seed);
  return Array.from({ length: 20 }, (_, i) => ({
    key: i,
    id: WEAPONS[Math.floor(rng() * WEAPONS.length)].id,
  }));
}
export class Game {
  constructor({
    seed = 1,
    type = "mountain",
    players = [
      { name: "Player 1", color: "#f21816" },
      { name: "Player 2", color: "#ff9900" },
    ],
    inventories,
    practice = false,
    wind = 0,
    kick = true,
  } = {}) {
    this.seed = seed;
    this.rng = random(seed);
    this.ground = terrain(seed, type);
    this.type = type;
    this.practice = practice;
    this.wind = wind;
    this.windOn = !!wind;
    this.kick = kick;
    this.tanks = players.map((p, i) => ({
      ...p,
      x: i ? 673 : 90,
      y: 0,
      angle: i ? 135 : 45,
      power: 55,
      score: 0,
      moves: 4,
      shots: 0,
      inventory: [
        ...(inventories?.[i] ??
          WEAPONS.slice(i * 10, i * 10 + 10).map((w) => w.id)),
      ],
    }));
    for (const t of this.tanks) {
      this.flatten(t.x, 16);
      t.y = this.surface(t.x) - 4;
    }
    this.turn = 0;
    this.phase = "aiming";
    this.time = 0;
    this.projectiles = [];
    this.nextProjectileId = 1;
    this.effects = [];
    this.labels = [];
    this.pending = [];
    this.events = [];
    this.lastShot = null;
    this.quiet = 0;
    this.history = [];
    this.selected = 0;
    this.movement = null;
  }
  get active() {
    return this.tanks[this.turn];
  }
  surface(x) {
    return this.ground[clamp(Math.round(x), 0, 799)];
  }
  flatten(x, r) {
    const y = this.surface(x),
      shoulder = 16;
    for (
      let i = Math.max(0, Math.floor(x - r - shoulder));
      i <= Math.min(799, x + r + shoulder);
      i++
    ) {
      const u = clamp((Math.abs(i - x) - r) / shoulder, 0, 1),
        blend = u * u * (3 - 2 * u);
      this.ground[i] = y * (1 - blend) + this.ground[i] * blend;
    }
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  takeEvents() {
    return this.events.splice(0);
  }
  schedule(delay, fn) {
    this.pending.push({ at: this.time + delay, fn });
  }
  crater(x, y, r) {
    if (r <= 0) return;
    for (
      let i = Math.max(0, Math.floor(x - r));
      i <= Math.min(799, Math.ceil(x + r));
      i++
    ) {
      const dy = Math.sqrt(Math.max(0, r * r - (i - x) ** 2));
      if (y + dy >= this.ground[i] && y - dy <= SKY)
        this.ground[i] = clamp(Math.max(this.ground[i], y + dy), 0, 440);
    }
  }
  dirt(x, y, r) {
    for (
      let i = Math.max(0, Math.floor(x - r));
      i <= Math.min(799, Math.ceil(x + r));
      i++
    ) {
      const top = y - Math.sqrt(Math.max(0, r * r - (i - x) ** 2));
      this.ground[i] = clamp(Math.min(this.ground[i], top), 62, 440);
    }
  }
  support(x) {
    const at = (xx) => {
      const lo = clamp(Math.floor(xx), 0, 799),
        hi = Math.min(799, lo + 1);
      return (
        this.ground[lo] +
        (this.ground[hi] - this.ground[lo]) * clamp(xx - lo, 0, 1)
      );
    };
    return Math.min(at(x - 5), at(x), at(x + 5)) - 4;
  }
  settle(dt) {
    for (const t of this.tanks) {
      if (this.movement && t === this.active) continue;
      const support = this.support(t.x);
      if (t.y < support) {
        t.fallVelocity = (t.fallVelocity ?? 0) + 240 * dt;
        t.y = Math.min(support, t.y + t.fallVelocity * dt);
      } else t.fallVelocity = 0;
      t.x = clamp(t.x, 12, 788);
    }
  }
  move(dir) {
    if (
      this.phase !== "aiming" ||
      this.active.moves <= 0 ||
      ![-1, 1].includes(dir)
    )
      return false;
    const t = this.active,
      nx = clamp(t.x + dir * 25, 14, 786);
    if (
      nx === t.x ||
      this.surface(t.x) < t.y - 8 ||
      Math.abs(t.y - this.support(t.x)) > 2 ||
      Math.abs(this.surface(nx) - this.surface(t.x)) > 28 ||
      Math.abs(nx - this.tanks[1 - this.turn].x) < 25
    )
      return false;
    // Check the whole path, including narrow walls and tanks between endpoints.
    for (let x = t.x; dir > 0 ? x <= nx : x >= nx; x += dir) {
      if (
        Math.abs(this.surface(x) - this.surface(t.x)) > 28 ||
        Math.abs(this.surface(x + dir) - this.surface(x)) > 6 ||
        Math.abs(x - this.tanks[1 - this.turn].x) < 25
      )
        return false;
    }
    this.movement = { from: t.x, to: nx, elapsed: 0, duration: 0.7, dust: 0 };
    this.phase = "moving";
    t.moves--;
    this.emit("move");
    return true;
  }
  advanceMovement(dt) {
    const m = this.movement;
    if (!m) return;
    m.elapsed = Math.min(m.duration, m.elapsed + dt);
    const u = m.elapsed / m.duration,
      ease = u * u * (3 - 2 * u),
      t = this.active,
      previous = t.x;
    t.x = m.from + (m.to - m.from) * ease;
    t.y = this.support(t.x);
    t.tread = (t.tread ?? 0) + (t.x - previous);
    m.dust += Math.abs(t.x - previous);
    if (m.dust > 3) {
      m.dust = 0;
      this.effects.push({
        kind: "treadDust",
        x: t.x - Math.sign(m.to - m.from) * 9,
        y: t.y + 5,
        life: 0.35,
        max: 0.35,
      });
      this.emit("tread");
    }
    if (m.elapsed >= m.duration) {
      t.x = m.to;
      t.fallVelocity = 0;
      this.movement = null;
      this.phase = "aiming";
      this.emit("moved");
    }
  }
  aim(angle, power) {
    if (
      this.phase !== "aiming" ||
      !Number.isFinite(angle) ||
      !Number.isFinite(power)
    )
      return;
    this.active.angle = ((Math.round(angle) % 360) + 360) % 360;
    this.active.power = clamp(Math.round(power), 0, 100);
  }
  spawn(id, x, y, vx, vy, extra = {}) {
    const w = weaponById[id];
    const p = {
      serial: this.nextProjectileId++,
      id,
      x,
      y,
      px: x,
      py: y,
      vx,
      vy,
      owner: this.turn,
      age: 0,
      life: 14,
      trail: [],
      damage: w.damage,
      radius: w.radius,
      color: w.color,
      ...extra,
    };
    this.projectiles.push(p);
    return p;
  }
  fire(id = this.active.inventory[this.selected]) {
    if (
      this.phase !== "aiming" ||
      !weaponById[id] ||
      (!this.practice && !this.active.inventory.includes(id))
    )
      return false;
    const t = this.active,
      a = (t.angle * Math.PI) / 180,
      speed = t.power * 5.1,
      { x, y } = launch(t);
    if (!this.practice) t.inventory.splice(t.inventory.indexOf(id), 1);
    t.shots++;
    this.selected = 0;
    this.phase = "firing";
    this.quiet = 0;
    this.lastShot = {
      owner: this.turn,
      weapon: id,
      angle: t.angle,
      power: t.power,
      scoreBefore: t.score,
    };
    this.emit("fire", { weapon: id });
    const shoot = (off = 0, extra = {}) => {
      const b = a + (off * Math.PI) / 180;
      return this.spawn(
        id,
        x,
        y,
        Math.cos(b) * speed,
        -Math.sin(b) * speed,
        extra,
      );
    };
    if (id === "mover") {
      for (let d = 0; d < 180; d += 5) {
        const xx = t.x + Math.cos(a) * d,
          yy = t.y - 5 - Math.sin(a) * d;
        this.crater(xx, yy, 12 + d * 0.25);
      }
      this.effects.push({
        kind: "cone",
        x: t.x,
        y: t.y,
        angle: a,
        life: 0.8,
        max: 0.8,
      });
    } else if (id === "triple" || id === "five" || id === "tracer") {
      const n = id === "triple" ? 3 : 5;
      for (let i = 0; i < n; i++)
        shoot((i - (n - 1) / 2) * 5, { offset: (i - (n - 1) / 2) * 5 });
    } else if (id === "tommy") {
      for (let i = 0; i < 10; i++)
        this.schedule(i * 0.085, () => {
          shoot((this.rng() - 0.5) * 2, { life: 12 });
          this.emit("tick");
        });
    } else shoot();
    return true;
  }
  score(owner, x, y, r, damage) {
    if (!damage) return;
    for (let i = 0; i < 2; i++) {
      const t = this.tanks[i],
        dist = Math.hypot(t.x - x, t.y - y),
        reach = Math.max(12, r + 9);
      if (dist > reach) continue;
      const points = Math.max(
        1,
        Math.round(damage * (1 - Math.max(0, dist - 10) / reach)),
      );
      const delta = i === owner ? -points : points;
      this.tanks[owner].score += delta;
      this.labels.push({
        x: t.x,
        y: t.y - 20,
        text: (delta > 0 ? "+" : "") + delta,
        color: delta > 0 ? "#ffff5b" : "#ff5656",
        life: 1.8,
        max: 1.8,
      });
      this.emit("score", { owner, delta });
      if (this.kick && damage >= 25) {
        t.x = clamp(
          t.x + (t.x >= x ? 1 : -1) * Math.min(5, damage * 0.05),
          12,
          788,
        );
      }
    }
  }
  blast(p, x = p.x, y = p.y, r = p.radius, damage = p.damage) {
    this.score(p.owner, x, y, r, damage);
    this.crater(x, y, r);
    this.effects.push({
      kind: "blast",
      x,
      y,
      r: Math.max(5, r),
      color: p.color,
      life: 0.5,
      max: 0.5,
    });
    this.emit("blast", { radius: r });
  }
  fragments(p, n, kind = "fragment") {
    for (let i = 0; i < n; i++) {
      const a =
        kind === "web"
          ? 0.15 + (i / (n - 1)) * Math.PI * 0.8
          : (i / n) * Math.PI * 2;
      const speed =
        kind === "web" ? 55 + this.rng() * 60 : 75 + this.rng() * 80;
      this.spawn(p.id, p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, {
        owner: p.owner,
        kind,
        damage: kind === "web" ? 10 : 12,
        radius: kind === "web" ? 10 : 14,
        color: kind === "web" ? "#ddd" : p.color,
        life: 5,
        gravity: kind === "web" ? 35 : GRAVITY,
      });
    }
  }
  impact(p) {
    const { x, y, id } = p,
      ordinary = () => this.blast(p);
    const surface = this.surface(x);
    if (p.kind === "web" || p.kind === "fragment") {
      ordinary();
      return;
    }
    if (id === "tracer") {
      this.labels.push({
        x,
        y: y - 15,
        text: (p.offset > 0 ? "+" : "") + p.offset + "°",
        color: "#88ff88",
        life: 3,
        max: 3,
      });
      return;
    }
    if (id === "wall") {
      const base = surface;
      for (let j = 1; j <= 24; j++)
        this.schedule(j * 0.025, () => {
          for (
            let k = Math.max(0, Math.round(x - 12));
            k < Math.min(800, x + 12);
            k++
          )
            this.ground[k] = Math.min(
              this.ground[k],
              Math.max(65, base - j * 6),
            );
        });
      return;
    }
    if (id === "dirt" || id === "slinger") {
      this.dirt(x, y, id === "dirt" ? 48 : 85);
      this.effects.push({
        kind: "dust",
        x,
        y,
        r: 55,
        color: "#83a649",
        life: 0.9,
        max: 0.9,
      });
      return;
    }
    if (id === "pile") {
      for (let i = 0; i < 8; i++)
        this.schedule(i * 0.08, () =>
          this.blast(p, x, Math.min(436, y + i * 15), 20, i === 0 ? 20 : 3),
        );
      return;
    }
    if (id === "chain") {
      for (let i = 0; i < 12; i++)
        this.schedule(i * 0.1, () => {
          const xx = clamp(x + (this.rng() - 0.5) * 100, 3, 796);
          this.blast(p, xx, this.surface(xx) - 2, 22, 20);
        });
      return;
    }
    if (id === "cracker") {
      for (let i = 0; i < 12; i++)
        for (const dir of [-1, 1])
          this.schedule(i * 0.07, () => {
            const xx = clamp(x + i * 13 * dir, 2, 797);
            this.blast(p, xx, this.surface(xx), 14, 5);
          });
      return;
    }
    if (id === "scatter") {
      for (let i = 0; i < 5; i++) {
        const a = ((-150 + i * 30) * Math.PI) / 180;
        this.spawn(id, x, surface - 3, Math.cos(a) * 95, Math.sin(a) * 95, {
          kind: "fragment",
          owner: p.owner,
          damage: 10,
          radius: 18,
        });
      }
      return;
    }
    if (id === "spider" || id === "ivan" || id === "pineapple") {
      if (
        Math.hypot(
          x - this.tanks[1 - p.owner].x,
          y - this.tanks[1 - p.owner].y,
        ) < 15
      )
        this.score(p.owner, x, y, 10, 100);
      this.fragments(
        p,
        id === "spider" ? 14 : 12,
        id === "spider" ? "web" : "fragment",
      );
      return;
    }
    if (id === "hail" || id === "napalm") {
      const n = id === "hail" ? 160 : 55;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * this.rng(),
          s = 15 + this.rng() * (id === "hail" ? 65 : 60);
        this.spawn(id, x, surface - 4, Math.cos(a) * s, Math.sin(a) * s, {
          kind: "liquid",
          owner: p.owner,
          life: id === "hail" ? 3.6 : 3.1,
          damage: id === "hail" ? 2 : 4,
          radius: 0,
          bounces: 0,
          gravity: 140,
        });
      }
      return;
    }
    if (["hog", "worm", "homingworm"].includes(id)) {
      this.spawn(
        id,
        x,
        surface + 6,
        (p.vx >= 0 ? 1 : -1) * 80,
        clamp(p.vy * 0.2, -30, 45),
        {
          kind: "dig",
          owner: p.owner,
          life: 4.2,
          digGround: Float64Array.from(this.ground),
        },
      );
      return;
    }
    if (id === "cruiser") {
      this.spawn(id, x, surface - 2, (p.vx >= 0 ? 1 : -1) * 65, 0, {
        kind: "cruise",
        owner: p.owner,
        life: 3.2,
      });
      return;
    }
    if (id === "skipper" && (p.bounces ?? 0) < 4) {
      this.spawn(
        id,
        x,
        surface - 3,
        p.vx * 0.8,
        -Math.max(40, Math.abs(p.vy) * 0.65),
        { owner: p.owner, bounces: (p.bounces ?? 0) + 1 },
      );
      return;
    }
    if (id === "jack" && (p.bounces ?? 0) < 5) {
      ordinary();
      this.spawn(id, x, this.surface(x) - 3, 0, -65, {
        owner: p.owner,
        bounces: (p.bounces ?? 0) + 1,
      });
      return;
    }
    if (id === "zapper") {
      this.score(p.owner, x, y, 48, 40);
      this.effects.push({
        kind: "zap",
        x,
        y,
        tx: this.tanks[1 - p.owner].x,
        ty: this.tanks[1 - p.owner].y,
        life: 0.35,
        max: 0.35,
      });
      return;
    }
    ordinary();
  }
  advanceProjectile(p, dt) {
    p.age += dt;
    p.px = p.x;
    p.py = p.y;
    if (p.age > p.life) {
      if (p.kind !== "liquid" && p.id !== "tracer") this.blast(p);
      return false;
    }
    const enemy = this.tanks[1 - p.owner];
    if (p.kind === "cruise") {
      p.x += p.vx * dt;
      p.y = this.surface(p.x) - 2;
      if (Math.abs(p.x - enemy.x) < 12 || p.x < 2 || p.x > 797) {
        this.blast(p);
        return false;
      }
      return true;
    }
    if (p.kind === "dig") {
      if (p.id === "homingworm") {
        p.vx = Math.abs(enemy.x - p.x) < 9 ? 0 : Math.sign(enemy.x - p.x) * 80;
        p.vy = Math.abs(enemy.x - p.x) < 10 ? -110 : 10;
      }
      if (p.id === "worm") p.vy -= 35 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.crater(p.x, p.y, 7);
      if (
        p.y <
          (p.digGround?.[clamp(Math.round(p.x), 0, 799)] ?? this.surface(p.x)) -
            3 ||
        p.x < 2 ||
        p.x > 797 ||
        p.y > 436
      ) {
        this.blast(p);
        return false;
      }
      return true;
    }
    const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (!p.kind) {
      if (p.id === "seeker" && dist < 100) {
        p.vx += (enemy.x - p.x) * dt * 3;
        p.vy += (enemy.y - p.y) * dt * 3;
      }
      if (p.id === "missile" && p.y < enemy.y && Math.abs(p.x - enemy.x) < 5) {
        p.vx = 0;
        p.vy = Math.max(60, p.vy);
      }
      if (
        ["spider", "ivan", "pineapple"].includes(p.id) &&
        dist < 88 &&
        p.age > 0.3
      ) {
        this.fragments(
          p,
          p.id === "spider" ? 14 : 12,
          p.id === "spider" ? "web" : "fragment",
        );
        return false;
      }
      if (p.id === "zapper" && dist < 55) {
        this.score(p.owner, enemy.x, enemy.y, 0, 40);
        this.effects.push({
          kind: "zap",
          x: p.x,
          y: p.y,
          tx: enemy.x,
          ty: enemy.y,
          life: 0.45,
          max: 0.45,
        });
        return false;
      }
    }
    ballisticStep(p, dt, this.wind, p.gravity ?? GRAVITY);
    if (p.kind === "liquid") {
      if (p.x < 1 || p.x > 798) {
        p.vx *= -0.6;
        p.x = clamp(p.x, 1, 798);
      }
      if (p.y >= this.surface(p.x) - 1) {
        p.y = this.surface(p.x) - 2;
        p.vy = -Math.abs(p.vy) * (p.id === "hail" ? 0.48 : 0.18);
        p.vx =
          p.vx * 0.91 + (this.surface(p.x - 3) - this.surface(p.x + 3)) * 1.2;
        p.bounces++;
        if (
          p.bounces % 3 === 1 &&
          p.age - (p.lastDamage ?? -1) > 0.28 &&
          (p.damageTicks ?? 0) < 3
        ) {
          this.score(p.owner, p.x, p.y, 10, p.damage);
          p.lastDamage = p.age;
          p.damageTicks = (p.damageTicks ?? 0) + 1;
        }
      }
      return true;
    }
    const hit = sweep(this, p, p.px, p.py);
    if (hit) {
      p.x = hit.x;
      p.y = hit.y;
      if (!hit.out) this.impact(p);
      return false;
    }
    if (
      p.trail.length === 0 ||
      Math.hypot(p.x - p.trail.at(-1).x, p.y - p.trail.at(-1).y) > 4
    ) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 100) p.trail.shift();
    }
    return true;
  }
  update(dt) {
    if (this.phase === "finished") return;
    this.time += dt;
    this.advanceMovement(dt);
    const due = this.pending.filter((e) => e.at <= this.time);
    this.pending = this.pending.filter((e) => e.at > this.time);
    for (const e of due) e.fn();
    // New fragments are queued during this loop and survive into the next step.
    const current = this.projectiles;
    this.projectiles = [];
    for (const p of current)
      if (this.advanceProjectile(p, dt)) this.projectiles.push(p);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    for (const e of this.labels) e.life -= dt;
    this.labels = this.labels.filter((e) => e.life > 0);
    this.settle(dt);
    if (this.phase === "firing") {
      if (
        !this.projectiles.length &&
        !this.pending.length &&
        this.tanks.every((t) => t.y >= this.support(t.x) - 0.1)
      )
        this.quiet += dt;
      else this.quiet = 0;
      if (this.quiet > 0.85) this.finishTurn();
    }
  }
  finishTurn() {
    if (this.lastShot) {
      this.lastShot.points =
        this.tanks[this.lastShot.owner].score - this.lastShot.scoreBefore;
      this.history.push({ ...this.lastShot });
    }
    if (!this.practice && this.tanks.every((t) => t.shots >= 10)) {
      this.phase = "finished";
      this.emit("end");
      return;
    }
    this.turn = 1 - this.turn;
    this.phase = "aiming";
    this.quiet = 0;
    this.selected = 0;
    if (this.windOn) this.wind = Math.round((this.rng() - 0.5) * 80);
    this.emit("turn");
  }
  snapshot() {
    return {
      phase: this.phase,
      practice: this.practice,
      turn: this.turn,
      seed: this.seed,
      wind: this.wind,
      projectiles: this.projectiles.length,
      pending: this.pending.length,
      tanks: this.tanks.map((t) => ({
        ...t,
        buried: this.surface(t.x) < t.y - 8,
      })),
      history: this.history,
    };
  }
}
// Predict ordinary ballistic shells, including tank hits and shots leaving the arena.
// Homing, fragmentation, bounces and digging intentionally change course later.
export function predict(game, tank, angle, power) {
  const p = {
    ...launch(tank, angle, power),
    owner: game.tanks.indexOf(tank),
    age: 0,
  };
  for (let i = 0; i < 14 / STEP; i++) {
    const x = p.x,
      y = p.y;
    p.age += STEP;
    ballisticStep(p, STEP, game.wind);
    const hit = sweep(game, p, x, y);
    if (hit) return hit;
  }
  return { x: p.x, y: p.y };
}
export function cpuAim(game, difficulty = "normal") {
  const tank = game.active,
    target = game.tanks[1 - game.turn];
  let best = { distance: Infinity, angle: 45, power: 55 };
  for (let angle = 15; angle <= 165; angle += 3)
    for (let power = 20; power <= 100; power += 2) {
      const hit = predict(game, tank, angle, power),
        distance = Math.hypot(hit.x - target.x, hit.y - target.y);
      if (distance < best.distance) best = { angle, power, distance };
    }
  const error = difficulty === "hard" ? 1 : difficulty === "easy" ? 10 : 4;
  return {
    angle: clamp(best.angle + Math.round((game.rng() - 0.5) * error), 0, 180),
    power: clamp(best.power + Math.round((game.rng() - 0.5) * error), 0, 100),
  };
}
