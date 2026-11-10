import "@fontsource/russo-one/latin-400.css";
import "@fontsource/lilita-one/latin-400.css";
import { profiles } from "./review-scenes.js";
import "./style.css";
import { Game, cpuAim, draftPool, hashSeed, random, clamp } from "./engine.js";
import { WEAPONS, weaponById } from "./weapons.js";
import { Renderer } from "./render.js";
import { Audio } from "./audio.js";

const $ = (s) => document.querySelector(s),
  escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
const COLORS = [
  ["Red", "#f20b05"],
  ["Orange", "#ed9100"],
  ["Yellow", "#d2d600"],
  ["Green", "#54dd00"],
  ["Cyan", "#00cccc"],
  ["Blue", "#1525ec"],
  ["Purple", "#8b00d3"],
  ["Pink", "#e000d0"],
];
let prefs = read("pt-prefs", {
    sound: true,
    difficulty: "normal",
    terrain: "mountain",
    wind: false,
    names: ["Mike", "Sarah"],
    colors: [6, 1],
  }),
  screen = "title",
  mode = "local",
  setupPlayer = 0,
  game = null,
  selected = 0,
  draft = [],
  inventories = [[], []],
  draftTurn = 0,
  weaponOpen = false,
  helpOpen = false,
  paused = false,
  cpuTimer = null,
  message = "",
  toastTimer = null,
  endSaved = false;
let titleFixture = false;
let matchSeed = hashSeed(Date.now()),
  saved = read("pt-match", null),
  scores = read("pt-scores", []);
const audio = new Audio(!prefs.sound);
$("#app").innerHTML =
  `<header class="page-bar"><a class="wordmark" href="./">POCKET TANKS <span>WEB REMAKE</span></a><div><button id="sound" title="Toggle sound (M)" aria-label="Toggle sound">${prefs.sound ? "♫ SOUND ON" : "♫ SOUND OFF"}</button><button id="help" aria-label="How to play">? HELP</button><button id="fullscreen" aria-label="Fullscreen">⛶</button><a href="https://github.com/yagyesh-bobde/pocket-tanks" target="_blank" rel="noopener">GITHUB ↗</a></div></header>
<main><div id="shell"><div id="stage"><canvas id="scene" width="800" height="600" aria-label="Pocket Tanks battlefield"></canvas><div id="panel"></div><div id="hud"></div><div id="overlay"></div><div id="toast" role="status" aria-live="polite"></div></div></div></main>
<footer class="page-footer"><span>A fan-made tribute to the 2001 artillery classic. Original code, art & sound.</span><span>Not affiliated with Blitwise Productions.</span></footer>`;
const touchControls = document.createElement("div");
touchControls.id = "touch-controls";
touchControls.setAttribute("aria-label", "Touch controls");
$("main").append(touchControls);
const renderer = new Renderer($("#scene"));
function resize() {
  const availableW = Math.max(260, window.innerWidth - 24),
    availableH = Math.max(240, window.innerHeight - 102);
  const scale = Math.min(availableW / 800, availableH / 600, 1.5);
  $("#shell").style.width = 800 * scale + "px";
  $("#shell").style.height = 600 * scale + "px";
  $("#stage").style.transform = `scale(${scale})`;
}
window.addEventListener("resize", resize);
resize();
document.fonts.ready.then(draw);
function persistPrefs() {
  write("pt-prefs", prefs);
}
function toast(text) {
  message = text;
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}
function draw() {
  const champion = scores[0];
  renderer.draw({
    screen,
    game,
    paused,
    playerNames: titleFixture
      ? ["Mike", "Sarah"]
      : (champion?.names ?? prefs.names),
    titleScores: titleFixture ? [0, 125] : (champion?.scores ?? [0, 0]),
  });
}
function go(next) {
  clearTimeout(cpuTimer);
  cpuTimer = null;
  screen = next;
  weaponOpen = false;
  paused = false;
  helpOpen = false;
  render();
  draw();
}
function title() {
  titleFixture = false;
  go("menu");
}
function names() {
  return prefs.names.map((name, i) => ({
    name: name.trim() || `Player ${i + 1}`,
    color: COLORS[prefs.colors[i]][1],
  }));
}
function begin(type) {
  mode = type;
  matchSeed = hashSeed(Date.now());
  endSaved = false;
  game = null;
  if (type === "practice") {
    startBattle();
    return;
  }
  setupPlayer = 0;
  go("setup");
}
function finishSetup() {
  const input = $("#player-name");
  if (input) {
    prefs.names[setupPlayer] =
      input.value.trim().slice(0, 12) || `Player ${setupPlayer + 1}`;
    persistPrefs();
  }
  if (setupPlayer === 0) {
    setupPlayer = 1;
    render();
    draw();
  } else {
    draft = draftPool(matchSeed);
    inventories = [[], []];
    draftTurn = 0;
    go("draft");
  }
}
function choose(key) {
  if (screen !== "draft" || (mode === "cpu" && draftTurn === 1)) return;
  pick(key);
}
function pick(key) {
  const i = draft.findIndex((w) => w.key === key);
  if (i < 0) return;
  inventories[draftTurn].push(draft.splice(i, 1)[0].id);
  draftTurn = 1 - draftTurn;
  audio.sound("click");
  if (!draft.length) {
    startBattle();
    return;
  }
  render();
  if (mode === "cpu" && draftTurn === 1) {
    cpuTimer = setTimeout(() => {
      if (screen === "draft")
        pick(
          draft[Math.floor(random(matchSeed + draft.length)() * draft.length)]
            .key,
        );
    }, 420);
  }
}
function randomDraft() {
  clearTimeout(cpuTimer);
  const rng = random(matchSeed + draft.length);
  while (draft.length) {
    inventories[draftTurn].push(
      draft.splice(Math.floor(rng() * draft.length), 1)[0].id,
    );
    draftTurn = 1 - draftTurn;
  }
  startBattle();
}
function startBattle() {
  game = new Game({
    seed: matchSeed,
    type: prefs.terrain,
    players: names(),
    inventories:
      mode === "practice"
        ? [WEAPONS.map((w) => w.id), WEAPONS.map((w) => w.id)]
        : inventories,
    practice: mode === "practice",
    wind: prefs.wind ? 25 : 0,
  });
  selected = 0;
  go("battle");
  saveMatch();
  toast(
    mode === "practice"
      ? "Target practice · unlimited weapons"
      : "Ten volleys. Most points wins.",
  );
}
function saveMatch() {
  if (!game || game.phase !== "aiming" || game.practice) return;
  const data = {
    seed: game.seed,
    type: game.type,
    wind: game.wind,
    windOn: game.windOn,
    mode,
    turn: game.turn,
    ground: [...game.ground],
    tanks: game.tanks,
    history: game.history,
  };
  write("pt-match", data);
  saved = data;
}
function resume() {
  if (!saved) return;
  mode = saved.mode;
  game = new Game({
    seed: saved.seed,
    type: saved.type,
    players: saved.tanks,
    inventories: saved.tanks.map((t) => t.inventory),
    wind: saved.wind,
  });
  Object.assign(game, {
    turn: saved.turn,
    windOn: saved.windOn,
    tanks: saved.tanks,
    history: saved.history,
    ground: Float64Array.from(saved.ground),
  });
  selected = 0;
  go("battle");
  scheduleCPU();
}
function list() {
  return game?.practice
    ? WEAPONS.map((w) => w.id)
    : (game?.active.inventory ?? []);
}
function weapon() {
  return weaponById[list()[selected]];
}
function canPlay() {
  return (
    screen === "battle" &&
    game?.phase === "aiming" &&
    !paused &&
    !helpOpen &&
    !(mode === "cpu" && game.turn === 1)
  );
}
function fire() {
  if (!canPlay() || weaponOpen) return;
  game.selected = selected;
  if (game.fire(list()[selected])) {
    selected = 0;
    renderHUD();
  }
}
function move(dir) {
  if (!canPlay()) return;
  if (game.move(dir)) {
    audio.sound("click");
    saveMatch();
    renderHUD();
    draw();
  } else
    toast(
      game.active.moves
        ? "Too steep or buried. Clear the ground first."
        : "No moves left this match.",
    );
}
function aim(da, dp) {
  if (!canPlay()) return;
  game.aim(game.active.angle + da, game.active.power + dp);
  renderHUD();
  draw();
}
function cycle(dir) {
  if (!canPlay()) return;
  selected = (selected + dir + list().length) % list().length;
  renderHUD();
  if (weaponOpen) renderOverlay();
}
function scheduleCPU() {
  clearTimeout(cpuTimer);
  if (
    screen !== "battle" ||
    !game ||
    game.phase !== "aiming" ||
    game.turn !== 1 ||
    mode !== "cpu" ||
    paused ||
    helpOpen
  )
    return;
  cpuTimer = setTimeout(() => {
    if (screen !== "battle" || paused || helpOpen) return;
    const a = cpuAim(game, prefs.difficulty);
    game.aim(a.angle, a.power);
    selected = Math.floor(game.rng() * list().length);
    game.selected = selected;
    renderHUD();
    draw();
    cpuTimer = setTimeout(() => {
      if (screen === "battle" && !paused && !helpOpen) {
        game.fire(list()[selected]);
        selected = 0;
        renderHUD();
      }
    }, 650);
  }, 600);
}
function finishMatch() {
  if (!endSaved) {
    endSaved = true;
    const winner =
      game.tanks[0].score === game.tanks[1].score
        ? -1
        : game.tanks[0].score > game.tanks[1].score
          ? 0
          : 1;
    scores.push({
      names: game.tanks.map((t) => t.name),
      scores: game.tanks.map((t) => t.score),
      winner,
      date: new Date().toISOString(),
    });
    scores = scores
      .sort((a, b) => Math.max(...b.scores) - Math.max(...a.scores))
      .slice(0, 5);
    write("pt-scores", scores);
    write("pt-match", null);
    saved = null;
  }
  go("end");
  audio.sound("end");
}
function render() {
  const p = $("#panel");
  p.innerHTML = "";
  if (screen === "title")
    p.innerHTML = `<button class="splash-hit" data-action="title" aria-label="Click to start"></button><button class="start-text" data-action="title">Click to Start</button><div class="splash-copy"><div class="chrome">AN OPEN-SOURCE TRIBUTE TO<br>POCKET TANKS</div><div class="chrome">THE ULTIMATE ONE-ON-ONE<br>ARTILLERY GAME</div><button class="chrome" data-action="title">PLAY IN YOUR WEB BROWSER<br>FREE AND OPEN SOURCE</button></div><div class="title-credits">Original web remake · MIT License <span>Game concept © Blitwise Productions</span></div>`;
  if (screen === "menu")
    p.innerHTML = `<h1 class="chrome">POCKET TANKS</h1><div class="main-menu">${saved ? '<button class="gold" data-action="resume">RESUME MATCH</button>' : ""}<button class="chrome" data-mode="cpu">1 PLAYER</button><button class="chrome" data-mode="local">2 PLAYERS</button><button class="chrome" data-mode="practice">TARGET PRACTICE</button><button class="chrome small" data-action="options">OPTIONS</button></div><div class="menu-note">Choose your angle. Set your power. Make every shot count.</div>`;
  if (screen === "setup") {
    const n = setupPlayer,
      color = prefs.colors[n];
    p.innerHTML = `<h1 class="chrome setup-heading">${mode === "cpu" && n === 1 ? "COMPUTER" : "PLAYER " + (n + 1)}</h1><div class="name-row"><label class="chrome" for="player-name">NAME:</label><input id="player-name" aria-label="Player ${n + 1} name" maxlength="12" value="${escape(prefs.names[n])}" autocomplete="off" spellcheck="false"></div><div class="color-row"><span class="chrome">COLOR:</span><span class="color-name" style="--color:${COLORS[color][1]}">${COLORS[color][0].toUpperCase()}</span></div><div class="swatches" role="group" aria-label="Tank color">${COLORS.map(([name, c], i) => `<button data-color="${i}" class="swatch ${color === i ? "chosen" : ""}" aria-label="${name}" aria-pressed="${color === i}" style="--color:${c}"><i>◒</i></button>`).join("")}</div>${mode === "cpu" && n === 1 ? `<label class="difficulty">Difficulty <select id="difficulty"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label>` : ""}<button class="gold continue" data-action="continue">CONTINUE</button><button class="back" data-action="menu">← Back</button>`;
    if ($("#difficulty")) $("#difficulty").value = prefs.difficulty;
  }
  if (screen === "draft") {
    const ns = names();
    p.innerHTML = `<h1 class="chrome shop-heading">WEAPON SHOP</h1><div class="shop-instruction">${mode === "cpu" && draftTurn === 1 ? "Computer is choosing…" : "Select a Weapon:"}</div>${ns.map((t, i) => `<section class="draft-side side-${i}" style="--color:${t.color}"><h2>${escape(t.name.toUpperCase())}</h2><ol>${inventories[i].map((id) => `<li>${escape(weaponById[id].name)}</li>`).join("")}</ol><small>${inventories[i].length} / 10</small></section>`).join("")}<div class="pick-arrow ${draftTurn ? "right" : ""}"><span>PICK<br>ONE</span><b>${draftTurn ? "➜" : "⬅"}</b></div><div class="shop-weapons">${draft
      .map((w) => {
        const item = weaponById[w.id];
        return `<button data-pick="${w.key}" title="${escape(item.description)}" ${mode === "cpu" && draftTurn === 1 ? "disabled" : ""}><i class="weapon-icon" style="--icon:${item.color}">${item.icon}</i>${escape(item.name)}</button>`;
      })
      .join(
        "",
      )}</div><button class="metal-button random" data-action="random">Random</button><button class="back" data-action="menu">← Back</button>`;
  }
  if (screen === "options")
    p.innerHTML = `<h1 class="chrome">OPTIONS</h1><div class="options-form"><label>Terrain<select id="terrain"><option value="mountain">Mountains</option><option value="valley">Valley</option><option value="cliff">Cliff</option><option value="plains">Plains</option></select></label><label>Wind<select id="wind"><option value="off">Off · classic default</option><option value="on">On · changes each turn</option></select></label><label>Computer<select id="option-difficulty"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label><p>Ten volleys · four moves per tank<br>Self-hits subtract from your score</p></div><button class="gold continue" data-action="save-options">CONTINUE</button>`;
  if (screen === "options") {
    $("#terrain").value = prefs.terrain;
    $("#wind").value = prefs.wind ? "on" : "off";
    $("#option-difficulty").value = prefs.difficulty;
  }
  if (screen === "end") {
    const [a, b] = game.tanks,
      drawn = a.score === b.score,
      winner = a.score > b.score ? a : b;
    p.innerHTML = `<div class="results"><p class="eyebrow">TEN VOLLEYS COMPLETE</p><h1 class="gold">${drawn ? "A PERFECT TIE" : escape(winner.name.toUpperCase()) + " WINS!"}</h1><div class="scorecards">${game.tanks.map((t) => `<div style="--color:${t.color}"><strong>${escape(t.name)}</strong><b class="chrome">${t.score}</b><span>10 shots · ${t.moves} moves left</span></div>`).join("")}</div><div class="result-details"><span>Best shot</span><strong>${bestShot()}</strong></div><div class="result-actions"><button class="metal-button" data-action="rematch">Play Again</button><button class="metal-button" data-action="new">New Match</button><button class="metal-button" data-action="menu">Main Menu</button></div><button class="plain log-toggle" data-action="log">View shot-by-shot scorecard ↓</button><div id="shot-log" hidden>${game.history.map((h, i) => `<div>${i + 1}. ${escape(game.tanks[h.owner].name)} · ${weaponById[h.weapon].name}<b>${h.points > 0 ? "+" : ""}${h.points}</b></div>`).join("")}</div></div>`;
  }
  renderHUD();
  renderOverlay();
}
function bestShot() {
  const h = game.history.reduce(
    (a, b) => (!a || b.points > a.points ? b : a),
    null,
  );
  return h
    ? `${escape(weaponById[h.weapon].name)} · ${h.points > 0 ? "+" : ""}${h.points} points`
    : "No shots";
}
function renderHUD() {
  const h = $("#hud");
  h.hidden = screen === "title";
  touchControls.hidden = screen !== "battle";
  if (h.hidden) return;
  const playing = screen === "battle",
    t = game?.active,
    w = weapon(),
    disabled = !playing || !canPlay();
  touchControls.innerHTML = playing
    ? `<div class="touch-number"><span>ANGLE</span><button data-touch="angle:1" aria-label="Touch increase angle" ${disabled ? "disabled" : ""}>＋</button><output>${t.angle}°</output><button data-touch="angle:-1" aria-label="Touch decrease angle" ${disabled ? "disabled" : ""}>−</button></div><div class="touch-number"><span>POWER</span><button data-touch="power:-1" aria-label="Touch decrease power" ${disabled ? "disabled" : ""}>−</button><output>${t.power}</output><button data-touch="power:1" aria-label="Touch increase power" ${disabled ? "disabled" : ""}>＋</button></div><select id="touch-weapon" aria-label="Touch weapon" ${disabled ? "disabled" : ""}>${list()
        .map(
          (id, i) =>
            `<option value="${i}" ${i === selected ? "selected" : ""}>${weaponById[id].name}</option>`,
        )
        .join(
          "",
        )}</select><button class="touch-fire" data-touch="fire" ${disabled ? "disabled" : ""}>FIRE</button><div class="touch-moves"><button data-touch="move:-1" aria-label="Touch move left" ${disabled ? "disabled" : ""}>← MOVE</button><span>${t.moves} moves left</span><button data-touch="move:1" aria-label="Touch move right" ${disabled ? "disabled" : ""}>MOVE →</button></div>`
    : "";
  h.innerHTML = `<div class="move-control"><button data-move="-1" aria-label="Move left" ${disabled ? "disabled" : ""}>❮❮</button><div><span>Move</span><b>${playing ? t.moves : ""}</b></div><button data-move="1" aria-label="Move right" ${disabled ? "disabled" : ""}>❯❯</button></div><button class="fire" data-action="fire" ${disabled ? "disabled" : ""}>Fire</button><div class="angle-control"><label for="angle">Angle</label><div><button data-adjust="angle:-1" aria-label="Decrease angle" ${disabled ? "disabled" : ""}>◀</button><input id="angle" aria-label="Angle in degrees" type="number" min="0" max="359" value="${playing ? t.angle : ""}" ${disabled ? "disabled" : ""}><span>°</span><button data-adjust="angle:1" aria-label="Increase angle" ${disabled ? "disabled" : ""}>▶</button></div></div><div class="weapon-control"><label>Weapon</label><button class="weapon-select" data-action="weapons" aria-label="Choose weapon" ${disabled ? "disabled" : ""}>${playing && w ? `<i class="weapon-icon" style="--icon:${w.color}">${w.icon}</i><span>${w.name}</span>` : ""}</button><div class="weapon-arrows"><button data-cycle="-1" aria-label="Previous weapon" ${disabled ? "disabled" : ""}>▲</button><button data-cycle="1" aria-label="Next weapon" ${disabled ? "disabled" : ""}>▼</button></div></div><div class="power-control"><input id="power-slider" type="range" aria-label="Shot power" min="0" max="100" value="${playing ? t.power : 0}" style="--power:${playing ? t.power : 0}%" ${disabled ? "disabled" : ""}><div><label for="power">Power</label><button data-adjust="power:-1" aria-label="Decrease power" ${disabled ? "disabled" : ""}>◀</button><input id="power" aria-label="Power" type="number" min="0" max="100" value="${playing ? t.power : ""}" ${disabled ? "disabled" : ""}><button data-adjust="power:1" aria-label="Increase power" ${disabled ? "disabled" : ""}>▶</button></div></div>${playing ? `<div class="turn-status" aria-live="polite">${game.phase === "firing" ? "SHOT IN FLIGHT" : mode === "cpu" && game.turn === 1 ? "COMPUTER THINKING" : escape(t.name.toUpperCase()) + "’S TURN"}<span>${game.practice ? "Unlimited arsenal" : t.inventory.length + " weapons left"}${game.surface(t.x) < t.y - 8 ? " · BURIED" : ""}</span></div><button class="battle-menu" data-action="pause" aria-label="Pause match">Ⅱ</button>` : ""}`;
}
function renderOverlay() {
  const o = $("#overlay");
  o.innerHTML = "";
  if (helpOpen)
    o.innerHTML = `<div class="veil"><section class="dialog help-dialog"><button class="close" data-action="close-help" aria-label="Close help">×</button><h2 class="chrome">HOW TO PLAY</h2><p>Draft ten weapons each, then take turns firing. Earn points for hitting the other tank. Hitting yourself loses points. The highest score after ten volleys wins.</p><p><strong>Aim by eye.</strong> 0° points right, 90° up, 180° left. More power sends a shell farther. Watch the last shot’s arc to adjust.</p><p>Each tank has four moves for the whole match. Explosions reshape the hills. Dirt weapons can bury tanks; fire downward or use Dirt Mover to dig out.</p><div class="key-guide"><span>← / →</span><b>Increase / decrease angle</b><span>↑ / ↓</span><b>Increase / decrease power</b><span>A / Z</span><b>Previous / next weapon</b><span>, / .</span><b>Move left / right</b><span>Space</span><b>Fire</b><span>M · Esc</span><b>Mute · pause / menu</b></div><p class="help-small">Touch: tap the angle and power values, use their arrows, drag the red power bar, and tap Weapon to open your arsenal. Tap the battlefield to aim your turret.</p><button class="metal-button" data-action="close-help">Got it</button></section></div>`;
  else if (paused)
    o.innerHTML = `<div class="veil"><section class="dialog pause-dialog"><h2 class="chrome">PAUSED</h2><p>${game.practice ? "Target practice · unlimited weapons" : "Your match is saved between turns."}</p><button class="gold" data-action="unpause">CONTINUE</button><button class="chrome small" data-action="restart">RESTART MATCH</button><button class="chrome small" data-action="menu">MAIN MENU</button></section></div>`;
  else if (weaponOpen)
    o.innerHTML = `<div class="armory"><header><h2 class="chrome">SELECT WEAPON</h2><button class="close" data-action="weapons" aria-label="Close arsenal">×</button></header><div class="arsenal-list">${list()
      .map((id, i) => {
        const w = weaponById[id];
        return `<button data-weapon="${i}" class="${i === selected ? "selected" : ""}" title="${escape(w.description)}"><i class="weapon-icon" style="--icon:${w.color}">${w.icon}</i>${w.name}</button>`;
      })
      .join("")}</div><p>${escape(weapon()?.description ?? "")}</p></div>`;
}
function pause() {
  if (screen !== "battle") return;
  paused = !paused;
  clearTimeout(cpuTimer);
  weaponOpen = false;
  renderHUD();
  renderOverlay();
  if (!paused) scheduleCPU();
}
function showHelp() {
  helpOpen = !helpOpen;
  clearTimeout(cpuTimer);
  renderHUD();
  renderOverlay();
  if (!helpOpen) scheduleCPU();
}
function action(a) {
  audio.unlock();
  switch (a) {
    case "title":
      title();
      break;
    case "menu":
      saveMatch();
      go("menu");
      break;
    case "resume":
      resume();
      break;
    case "options":
      go("options");
      break;
    case "continue":
      if ($("#difficulty")) prefs.difficulty = $("#difficulty").value;
      finishSetup();
      break;
    case "random":
      randomDraft();
      break;
    case "fire":
      fire();
      break;
    case "weapons":
      if (canPlay()) {
        weaponOpen = !weaponOpen;
        renderOverlay();
      }
      break;
    case "pause":
    case "unpause":
      pause();
      break;
    case "close-help":
      showHelp();
      break;
    case "save-options":
      prefs.terrain = $("#terrain").value;
      prefs.wind = $("#wind").value === "on";
      prefs.difficulty = $("#option-difficulty").value;
      persistPrefs();
      go("menu");
      break;
    case "rematch":
    case "restart":
      endSaved = false;
      startBattle();
      break;
    case "new":
      begin(mode);
      break;
    case "log":
      $("#shot-log").hidden = !$("#shot-log").hidden;
      break;
  }
}
$("#stage").addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el || el.disabled) return;
  if (el.dataset.action) action(el.dataset.action);
  if (el.dataset.mode) begin(el.dataset.mode);
  if (el.dataset.color !== undefined) {
    prefs.colors[setupPlayer] = +el.dataset.color;
    const other = 1 - setupPlayer;
    if (prefs.colors[other] === prefs.colors[setupPlayer])
      prefs.colors[other] = (prefs.colors[setupPlayer] + 3) % 8;
    const name = $("#player-name")?.value;
    if (name) prefs.names[setupPlayer] = name;
    persistPrefs();
    render();
    draw();
  }
  if (el.dataset.pick !== undefined) choose(+el.dataset.pick);
  if (el.dataset.move) move(+el.dataset.move);
  if (el.dataset.adjust) {
    const [type, delta] = el.dataset.adjust.split(":");
    aim(type === "angle" ? +delta : 0, type === "power" ? +delta : 0);
  }
  if (el.dataset.cycle) cycle(+el.dataset.cycle);
  if (el.dataset.weapon !== undefined) {
    selected = +el.dataset.weapon;
    weaponOpen = false;
    renderHUD();
    renderOverlay();
  }
});
touchControls.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  audio.unlock();
  const [a, v] = b.dataset.touch.split(":");
  if (a === "fire") fire();
  else if (a === "move") move(+v);
  else aim(a === "angle" ? +v : 0, a === "power" ? +v : 0);
});
touchControls.addEventListener("change", (e) => {
  if (e.target.id === "touch-weapon" && canPlay()) {
    selected = +e.target.value;
    renderHUD();
  }
});
$("#stage").addEventListener("change", (e) => {
  if (!canPlay()) return;
  if (e.target.id === "angle" || e.target.id === "power") {
    const a = Number($("#angle").value),
      p = Number($("#power").value);
    game.aim(Number.isFinite(a) ? a : 45, Number.isFinite(p) ? p : 55);
    renderHUD();
    draw();
  }
});
$("#stage").addEventListener("input", (e) => {
  if (e.target.id === "power-slider" && canPlay()) {
    game.aim(game.active.angle, +e.target.value);
    e.target.style.setProperty("--power", e.target.value + "%");
    $("#power").value = e.target.value;
    draw();
  }
});
$("#scene").addEventListener("pointerdown", (e) => {
  audio.unlock();
  if (!canPlay() || weaponOpen) return;
  const r = e.target.getBoundingClientRect(),
    x = ((e.clientX - r.left) * 800) / r.width,
    y = ((e.clientY - r.top) * 600) / r.height;
  if (y > 430 || y < 55) return;
  const t = game.active;
  let a = (Math.atan2(t.y - 5 - y, x - t.x) * 180) / Math.PI;
  game.aim(a, t.power);
  renderHUD();
  draw();
});
$("#sound").addEventListener("click", () => {
  audio.unlock();
  audio.muted = !audio.muted;
  prefs.sound = !audio.muted;
  persistPrefs();
  $("#sound").textContent = prefs.sound ? "♫ SOUND ON" : "♫ SOUND OFF";
});
$("#help").addEventListener("click", showHelp);
$("#fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Fullscreen is unavailable in this browser.");
  }
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    if (helpOpen) {
      showHelp();
      return;
    }
    if (weaponOpen) {
      weaponOpen = false;
      renderOverlay();
      return;
    }
    if (screen === "battle") pause();
    else go("menu");
    return;
  }
  if (e.target.matches("input,select,textarea")) {
    if (e.key === "Enter" && screen === "setup") finishSetup();
    return;
  }
  if (e.key.toLowerCase() === "m") {
    $("#sound").click();
    return;
  }
  if (screen === "title" && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    title();
    return;
  }
  if (!canPlay()) return;
  const actions = {
    ArrowLeft: () => aim(e.shiftKey ? 5 : 1, 0),
    ArrowRight: () => aim(e.shiftKey ? -5 : -1, 0),
    ArrowUp: () => aim(0, e.shiftKey ? 5 : 1),
    ArrowDown: () => aim(0, e.shiftKey ? -5 : -1),
    " ": fire,
    a: () => cycle(-1),
    z: () => cycle(1),
    ",": () => move(-1),
    ".": () => move(1),
  };
  if (actions[e.key]) {
    e.preventDefault();
    audio.unlock();
    actions[e.key]();
  }
});
let last = performance.now(),
  acc = 0;
function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game && screen === "battle" && !paused && !helpOpen) {
    acc += elapsed;
    while (acc >= 1 / 120) {
      game.update(1 / 120);
      acc -= 1 / 120;
    }
    const events = game.takeEvents();
    for (const e of events) {
      if (["fire", "blast", "move", "tick"].includes(e.type))
        audio.sound(e.type, e.radius);
      if (e.type === "turn") {
        audio.sound("turn");
        selected = 0;
        saveMatch();
        renderHUD();
        scheduleCPU();
      }
      if (e.type === "end") finishMatch();
    }
    draw();
  }
  requestAnimationFrame(frame);
}
render();
draw();
requestAnimationFrame(frame);
// Explicit deterministic scenes for screenshot review. Disabled unless ?review=1 is present.
if (new URLSearchParams(location.search).has("review")) {
  window.__review = {
    state: () => ({ screen, mode, paused, selected, game: game?.snapshot() }),
    scene(name) {
      if (name === "title") {
        titleFixture = true;
        go("title");
        return;
      }
      if (name === "setup") {
        mode = "local";
        setupPlayer = 0;
        game = null;
        prefs.names = ["Mike", "Sarah"];
        prefs.colors = [6, 1];
        go("setup");
        return;
      }
      if (name === "draft") {
        mode = "local";
        prefs.names = ["Jimmy", "Mark"];
        prefs.colors = [3, 2];
        draft = [
          "wall",
          "zapper",
          "skipper",
          "cruiser",
          "five",
          "mover",
          "skipper",
          "dirt",
          "skipper",
          "tommy",
          "big",
          "scatter",
          "cruiser",
          "single",
          "homingworm",
          "homingworm",
          "spider",
          "pile",
          "ivan",
          "pile",
        ].map((id, key) => ({ id, key }));
        inventories = [[], []];
        draftTurn = 0;
        go("draft");
        return;
      }
      mode = "practice";
      prefs.names = ["Player 1", "Player 2"];
      prefs.colors = [0, 1];
      prefs.terrain = "mountain";
      startBattle();
      game.kick = false;

      const key = name.startsWith("hail")
          ? "hail"
          : name.startsWith("tommy")
            ? "tommy"
            : "spider",
        points = profiles[key];
      for (let x = 0; x < 800; x++) {
        let i = 0;
        while (i < points.length - 2 && x > points[i + 1][0]) i++;
        const [x1, y1] = points[i],
          [x2, y2] = points[i + 1];
        game.ground[x] =
          y1 + ((y2 - y1) * (x - x1)) / (x2 - x1) + Math.sin(x * 1.7) * 0.6;
      }
      game.tanks[0].x = key === "tommy" ? 62 : key === "hail" ? 109 : 64;
      game.tanks[1].x = key === "tommy" ? 660 : key === "hail" ? 520 : 632;
      for (const t of game.tanks) t.y = game.surface(t.x) - 4;
      game.tanks[0].angle = key === "tommy" ? 29 : key === "hail" ? 70 : 69;
      game.tanks[0].power = key === "tommy" ? 59 : key === "hail" ? 73 : 76;
      selected = WEAPONS.findIndex((w) => w.id === key);
      if (name.endsWith("impact")) {
        if (key === "spider") {
          const p = { id: "spider", x: 607, y: 203, owner: 0, color: "#eee" };
          game.fragments(p, 14, "web");
          for (let i = 0; i < 114; i++) game.update(1 / 120);
          game.phase = "firing";
        }
        if (key === "hail") {
          game.impact({
            id: "hail",
            x: 576,
            y: 235,
            vx: 100,
            vy: 100,
            owner: 0,
          });
          for (let i = 0; i < 84; i++) game.update(1 / 120);
          game.phase = "firing";
        }
        if (key === "tommy") {
          game.fire("tommy");
          for (let i = 0; i < 230; i++) game.update(1 / 120);
        }
      }
      clearTimeout(toastTimer);
      $("#toast").classList.remove("visible");
      game.labels = [];
      game.tanks.forEach((t) => (t.score = 0));
      paused = true;
      renderHUD();
      draw();
    },
    advance(seconds) {
      for (let i = 0; i < seconds * 120; i++) game.update(1 / 120);
      draw();
      return game.snapshot();
    },
    aim(a, p) {
      game.aim(a, p);
      renderHUD();
      draw();
    },
    fire(id) {
      paused = false;
      selected = list().indexOf(id);
      game.selected = selected;
      game.fire(id);
      renderHUD();
    },
    finish() {
      for (let turns = 0; turns < 20 && game.phase !== "finished"; turns++) {
        if (game.phase === "aiming") game.fire(game.active.inventory[0]);
        for (let i = 0; i < 4000 && game.phase === "firing"; i++)
          game.update(1 / 120);
      }
      finishMatch();
      draw();
      return game.snapshot();
    },
    setPaused(value) {
      paused = value;
      renderHUD();
    },
  };
}
