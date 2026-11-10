import { WIDTH, SKY, clamp, random } from "./engine.js";
const font = '"Russo One", sans-serif';
export function metal(
  ctx,
  text,
  x,
  y,
  size = 32,
  color = "silver",
  align = "left",
) {
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(1.23, 1);
  x = 0;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  const mix = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    return (
      "#" +
      [n >> 16, (n >> 8) & 255, n & 255]
        .map((v) =>
          Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  };
  const colors = color.startsWith("#")
    ? [mix(color, 0.22), color, mix(color, -0.25), mix(color, -0.6)]
    : color === "purple"
      ? ["#37005c", "#aa20ff", "#7200b8", "#510087"]
      : color === "gold"
        ? ["#fff480", "#d5b600", "#ba9400", "#706200"]
        : color === "red"
          ? ["#ff6250", "#f31512", "#c20700", "#790000"]
          : color === "orange"
            ? ["#ffd35d", "#ed9400", "#bc6100", "#653000"]
            : ["#f1f1f1", "#bdbdbd", "#888", "#b9b9b9"];
  const g = ctx.createLinearGradient(0, y, 0, y + size);
  colors.forEach((c, i) => g.addColorStop(i / 3, c));
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111";
  ctx.strokeText(text, x + 2, y + 3);
  ctx.fillStyle = "#323232";
  ctx.fillText(text, x + 2, y + 3);
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = 0.7;
  ctx.strokeText(text, x - 0.4, y - 0.4);
  ctx.restore();
}
export function logo(ctx, x, y, s = 1, flag = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.textAlign = "left";
  if (flag) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(107, 67, 67, 67, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#777";
    ctx.fillRect(38, 0, 140, 135);
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++) {
        ctx.fillStyle = (r + c) % 2 ? "#ddd" : "#555";
        ctx.fillRect(38 + c * 20, r * 20, 20, 20);
      }
    const g = ctx.createRadialGradient(85, 32, 4, 107, 68, 74);
    g.addColorStop(0, "#ffffff50");
    g.addColorStop(0.65, "#0000");
    g.addColorStop(1, "#000a");
    ctx.fillStyle = g;
    ctx.fillRect(30, 0, 160, 150);
    ctx.restore();
  }
  const letters = [
    ["P", 42, -12, 0.3, 110],
    ["o", 85, 23, 0.09, 77],
    ["c", 113, 19, -0.12, 81],
    ["k", 146, -5, -0.03, 90],
    ["e", 188, 22, 0.17, 78],
    ["t", 188, 5, -0.45, 99],
  ];
  for (const [letter, lx, ly, a, size] of letters) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a);
    ctx.font = `${size}px 'Lilita One', sans-serif`;
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#150021";
    ctx.lineWidth = 5;
    ctx.strokeText(letter, 3, 4);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#230039");
    g.addColorStop(0.3, "#360053");
    g.addColorStop(0.7, "#6800af");
    g.addColorStop(1, "#9200e6");
    ctx.fillStyle = g;
    ctx.fillText(letter, 0, 0);
    ctx.strokeStyle = "#b06fc0";
    ctx.lineWidth = 0.65;
    ctx.strokeText(letter, 0, 0);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(0, 88);
  ctx.scale(1.24, 0.86);
  ctx.font = `68px ${font}`;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#201400";
  ctx.lineWidth = 5;
  ctx.strokeText("TANKS", 2, 3);
  const g = ctx.createLinearGradient(0, 0, 0, 65);
  g.addColorStop(0, "#c3ac72");
  g.addColorStop(0.14, "#46300e");
  g.addColorStop(0.56, "#5d3500");
  g.addColorStop(0.85, "#ab6900");
  g.addColorStop(1, "#efb032");
  ctx.fillStyle = g;
  ctx.fillText("TANKS", 0, 0);
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = "#a67e3c";
  ctx.strokeText("TANKS", 0, 0);
  ctx.restore();
  ctx.restore();
}
function tank(ctx, t, ground) {
  ctx.save();
  ctx.translate(t.x, t.y);
  const slope = clamp(
    (ground[Math.min(799, Math.round(t.x + 7))] -
      ground[Math.max(0, Math.round(t.x - 7))]) /
      14,
    -0.8,
    0.8,
  );
  ctx.rotate(Math.atan(slope));
  ctx.fillStyle = "#252525";
  ctx.beginPath();
  ctx.roundRect(-11, 0, 22, 7, 4);
  ctx.fill();
  ctx.strokeStyle = t.color;
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = -7; i <= 7; i += 4) {
    ctx.fillStyle = "#bbb";
    ctx.beginPath();
    ctx.arc(i, 4, 1.5, 0, 7);
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, -7, 0, 3);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.3, t.color);
  g.addColorStop(1, "#2c1712");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(6, -5);
  ctx.lineTo(12, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-5, -8, 10, 5);
  ctx.rotate(-Math.atan(slope));
  const a = (t.angle * Math.PI) / 180;
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(Math.cos(a) * 16, -5 - Math.sin(a) * 16);
  ctx.stroke();
  ctx.strokeStyle = t.color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
export function displayTank(ctx, x = 595, y = 473) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.92, 0.92);
  // Original geometric illustration: two tracks, road wheels, sloped hull and turret.
  const g = ctx.createLinearGradient(0, 0, 180, 100);
  g.addColorStop(0, "#242424");
  g.addColorStop(0.4, "#c1c1c1");
  g.addColorStop(0.7, "#666");
  g.addColorStop(1, "#eee");
  ctx.fillStyle = "#444";
  ctx.strokeStyle = "#969696";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 44);
  ctx.lineTo(135, 72);
  ctx.lineTo(197, 33);
  ctx.lineTo(198, 59);
  ctx.lineTo(143, 119);
  ctx.lineTo(28, 71);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 50);
  ctx.lineTo(144, 88);
  ctx.lineTo(138, 122);
  ctx.lineTo(28, 83);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(31 + i * 14, 72 + i * 5);
    ctx.rotate(-0.3);
    ctx.scale(0.65, 1);
    const d = ctx.createRadialGradient(-2, -3, 1, 0, 0, 11);
    d.addColorStop(0, "#eee");
    d.addColorStop(0.5, "#555");
    d.addColorStop(0.7, "#aaa");
    d.addColorStop(1, "#333");
    ctx.fillStyle = d;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#777";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = "#bdbdbd";
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const xx = 18 + i * 7,
      yy = 54 + i * 2.7;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + 5, yy + 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xx + 9, yy + 27);
    ctx.lineTo(xx + 14, yy + 35);
    ctx.stroke();
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.lineTo(72, 13);
  ctx.lineTo(200, 41);
  ctx.lineTo(143, 91);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#777";
  ctx.stroke();
  const t = ctx.createLinearGradient(83, 3, 117, 65);
  t.addColorStop(0, "#bbb");
  t.addColorStop(0.15, "#555");
  t.addColorStop(0.7, "#888");
  t.addColorStop(1, "#ddd");
  ctx.fillStyle = t;
  ctx.beginPath();
  ctx.moveTo(67, 45);
  ctx.lineTo(83, 5);
  ctx.lineTo(129, 17);
  ctx.lineTo(151, 61);
  ctx.quadraticCurveTo(109, 77, 67, 45);
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.stroke();
  ctx.fillStyle = "#6d6d6d";
  ctx.beginPath();
  ctx.moveTo(83, 7);
  ctx.lineTo(88, 1);
  ctx.lineTo(128, 13);
  ctx.lineTo(131, 19);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#999";
  ctx.stroke();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#464646";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(132, 37);
  ctx.lineTo(195, 58);
  ctx.stroke();
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(133, 34);
  ctx.lineTo(195, 55);
  ctx.stroke();
  ctx.strokeStyle = "#dadada";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(134, 30);
  ctx.lineTo(195, 51);
  ctx.stroke();
  ctx.restore();
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cache = document.createElement("canvas");
    this.cache.width = 800;
    this.cache.height = 450;
    this.cached = null;
    this.noise = random(713);
    this.texture = Float32Array.from({ length: 800 * 450 }, () => this.noise());
  }
  terrain(game) {
    const g = game.ground;
    if (this.cached && g.every((v, i) => v === this.cached[i])) return;
    this.cached = Float64Array.from(g);
    const c = this.cache.getContext("2d"),
      img = c.createImageData(800, 450),
      bands = [
        [3, 0, 153, 0],
        [15, 3, 138, 0],
        [31, 4, 118, 0],
        [53, 5, 99, 0],
        [85, 5, 80, 0],
        [500, 4, 63, 0],
      ];
    const limits = [3, 15, 31, 53, 85, 500].map((depth, k) =>
      Float64Array.from(g, (_, x) => {
        const r = [0, 2, 6, 14, 28, 40][k];
        let sum = 0,
          n = 0;
        for (let j = Math.max(0, x - r); j <= Math.min(799, x + r); j++) {
          sum += g[j];
          n++;
        }
        return sum / n + depth;
      }),
    );
    for (let x = 0; x < 800; x++)
      for (let y = Math.max(0, Math.floor(g[x])); y < 450; y++) {
        const d = y - g[x],
          b = bands[limits.findIndex((a) => y < a[x])],
          n = 0.86 + this.texture[y * 800 + x] * 0.27,
          i = (y * 800 + x) * 4;
        img.data[i] = b[1] * n;
        img.data[i + 1] = b[2] * n;
        img.data[i + 2] = b[3] * n;
        img.data[i + 3] = 255;
      }
    c.putImageData(img, 0, 0);
  }
  draw({
    screen,
    game,
    playerNames = ["Player 1", "Player 2"],
    titleScores = [0, 125],
    paused = false,
  }) {
    const c = this.ctx;
    c.clearRect(0, 0, 800, 600);
    c.fillStyle = "#000";
    c.fillRect(0, 0, 800, 600);
    if (screen !== "title") {
      const g = c.createLinearGradient(0, 185, 0, 450);
      g.addColorStop(0, "#000");
      g.addColorStop(0.55, "#20002e");
      g.addColorStop(1, "#650094");
      c.fillStyle = g;
      c.fillRect(0, 180, 800, 270);
    }
    if (game && ["battle", "end"].includes(screen)) {
      this.terrain(game);
      c.drawImage(this.cache, 0, 0);
      for (const t of game.tanks) tank(c, t, game.ground);
      // Hide buried tanks beneath the actual ground surface.
      for (const t of game.tanks)
        if (game.surface(t.x) < t.y - 8) {
          c.save();
          c.beginPath();
          c.rect(t.x - 20, game.surface(t.x), 40, 450);
          c.clip();
          c.drawImage(this.cache, 0, 0);
          c.restore();
        }
      for (const p of game.projectiles) {
        c.save();
        if (p.kind === "liquid" && p.id === "hail") {
          c.shadowColor = "#159ff1";
          c.shadowBlur = 3;
          c.strokeStyle = "#32a9ef77";
          c.lineWidth = 2.1;
          c.beginPath();
          c.moveTo(p.x - p.vx * 0.07, p.y - p.vy * 0.07);
          c.lineTo(p.x, p.y);
          c.stroke();
        }
        if (p.trail?.length > 1 && p.id !== "tommy") {
          c.strokeStyle =
            p.id === "tommy"
              ? "#8494d070"
              : p.kind === "dig"
                ? "#c59e6366"
                : "#d5ccd236";
          c.lineWidth = p.kind === "web" ? 0.5 : 1;
          c.beginPath();
          p.trail.forEach((t, i) =>
            i ? c.lineTo(t.x, t.y) : c.moveTo(t.x, t.y),
          );
          c.lineTo(p.x, p.y);
          c.stroke();
        }
        if (p.id === "tommy") {
          c.strokeStyle = "#b3c4ff";
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          c.lineTo(p.x, p.y);
          c.stroke();
        }
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(
          p.x,
          p.y,
          p.kind === "liquid"
            ? p.id === "hail"
              ? 1.4
              : 2.1
            : p.kind === "web"
              ? 0.7
              : p.id === "tommy"
                ? 1.1
                : 2.2,
          0,
          7,
        );
        c.fill();
        if (p.kind === "liquid" && p.id === "napalm") {
          c.fillStyle = "#ffdc22";
          c.fillRect(p.x - 1, p.y - 5, 2, 5);
        }
        c.restore();
      }
      for (const e of game.effects) {
        const progress = 1 - e.life / e.max;
        c.save();
        if (e.kind === "blast") {
          const r = e.r * Math.sin((progress * Math.PI) / 2);
          c.globalAlpha = Math.min(1, e.life * 5);
          const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, r || 1);
          g.addColorStop(0, "#fff9b0");
          g.addColorStop(0.25, "#ffe42b");
          g.addColorStop(0.65, "#ff7a00");
          g.addColorStop(0.87, "#ab3100");
          g.addColorStop(1, "#4b1c0000");
          c.fillStyle = g;
          c.beginPath();
          c.arc(e.x, e.y, r, 0, 7);
          c.fill();
          c.lineWidth = 1.3;
          c.strokeStyle = "#ffa329";
          c.beginPath();
          c.arc(e.x, e.y, r * 0.9, 0, 7);
          c.stroke();
        }
        if (e.kind === "zap") {
          c.strokeStyle = "#f8ffae";
          c.lineWidth = 2;
          c.shadowColor = "#d7ff33";
          c.shadowBlur = 8;
          c.beginPath();
          c.moveTo(e.x, e.y);
          for (let i = 1; i < 9; i++)
            c.lineTo(
              e.x + ((e.tx - e.x) * i) / 9 + (i % 2 ? 4 : -4),
              e.y + ((e.ty - e.y) * i) / 9,
            );
          c.lineTo(e.tx, e.ty);
          c.stroke();
        }
        if (e.kind === "dust") {
          c.globalAlpha = e.life;
          c.fillStyle = e.color;
          for (let i = 0; i < 24; i++) {
            c.fillRect(
              e.x + Math.sin(i * 2.3) * e.r * progress,
              e.y - Math.abs(Math.cos(i * 4)) * 70 * progress,
              3,
              3,
            );
          }
        }
        if (e.kind === "cone") {
          c.globalAlpha = e.life;
          c.strokeStyle = "#a4c088";
          for (let i = -3; i <= 3; i++) {
            c.beginPath();
            c.moveTo(e.x, e.y);
            c.lineTo(
              e.x + Math.cos(e.angle + i * 0.09) * 160,
              e.y - Math.sin(e.angle + i * 0.09) * 160,
            );
            c.stroke();
          }
        }
        c.restore();
      }
      for (const l of game.labels) {
        c.globalAlpha = Math.min(1, l.life);
        c.font = `14px ${font}`;
        c.fillStyle = l.color;
        c.textAlign = "center";
        c.fillText(l.text, l.x, l.y - (l.max - l.life) * 18);
        c.globalAlpha = 1;
      }
      metal(c, game.tanks[0].name.toUpperCase(), 5, 3, 27, game.tanks[0].color);
      metal(
        c,
        game.tanks[1].name.toUpperCase(),
        795,
        3,
        27,
        game.tanks[1].color,
        "right",
      );
      metal(c, String(game.tanks[0].score), 6, 34, 24);
      metal(c, String(game.tanks[1].score), 794, 34, 24, "silver", "right");
      c.fillStyle = "#ddd";
      c.font = `11px ${font}`;
      c.textAlign = "center";
      c.fillText(
        game.practice
          ? "Target Practice"
          : `Volley ${Math.min(10, Math.floor(game.history.length / 2) + 1)} / 10`,
        400,
        15,
      );
      if (game.wind) {
        c.fillStyle = "#bbb";
        c.font = "10px monospace";
        c.fillText(
          `Wind ${game.wind < 0 ? "←" : "→"} ${Math.abs(game.wind)}`,
          400,
          32,
        );
      }
    }
    if (screen === "title") {
      metal(c, playerNames[0].toUpperCase(), 5, 5, 35, "purple");
      metal(c, String(titleScores[0]), 5, 39, 33);
      metal(c, playerNames[1].toUpperCase(), 795, 5, 35, "purple", "right");
      metal(c, String(titleScores[1]), 795, 39, 33, "silver", "right");
      logo(c, 190, 112, 1.5, false);
      for (const [x, y, r] of [
        [132, 172, 9],
        [390, 158, 11],
        [309, 218, 5],
        [696, 256, 8],
      ]) {
        const g = c.createRadialGradient(x - 3, y - 4, 1, x, y, r);
        g.addColorStop(0, "#eee");
        g.addColorStop(0.45, "#888");
        g.addColorStop(1, "#333");
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, 7);
        c.fill();
        c.strokeStyle = "#bbb";
        c.lineWidth = 0.7;
        for (let j = -1; j < 2; j++) {
          c.beginPath();
          c.ellipse(x, y + j * 4, r * 0.8, 2, 0.3, 0, 7);
          c.stroke();
        }
      }
      c.fillStyle = "#a4d1cd";
      c.font = "8px monospace";
      c.textAlign = "right";
      c.fillText("an open-source fan remake", 620, 326);
      const g = c.createLinearGradient(0, 0, 800, 0);
      ["#dbd740", "#8a00db", "#10afdb", "#d4c62c"].forEach((v, i) =>
        g.addColorStop(i / 3, v),
      );
      c.fillStyle = g;
      c.fillRect(0, 355, 800, 2);
      c.fillRect(0, 584, 800, 2);
    } else {
      const bg = c.createLinearGradient(0, 450, 0, 600);
      bg.addColorStop(0, "#414141");
      bg.addColorStop(0.08, "#292929");
      bg.addColorStop(0.7, "#252525");
      bg.addColorStop(1, "#161616");
      c.fillStyle = bg;
      c.fillRect(0, 450, 800, 150);
      c.strokeStyle = "#777";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 451);
      c.lineTo(800, 451);
      c.stroke();
      c.strokeStyle = "#141414";
      c.beginPath();
      c.moveTo(0, 454);
      c.lineTo(800, 454);
      c.stroke();
      logo(c, 10, 468, 0.76, true);
      displayTank(c);
      c.fillStyle = "#777";
      c.font = "7px monospace";
      c.textAlign = "right";
      c.fillText("ESC to Menu", 793, 593);
    }
  }
}
