// A thumbwheel: drag horizontally to scrub degrees, with one-degree detents.
export function angleWheel(angle, disabled = false, mobile = false) {
  return `<div class="angle-wheel ${mobile ? "mobile-wheel" : ""}" data-angle-wheel role="slider" tabindex="${disabled ? -1 : 0}" aria-label="${mobile ? "Touch angle picker" : "Drag angle picker"}" aria-valuemin="0" aria-valuemax="359" aria-valuenow="${angle}" aria-valuetext="${angle} degrees" aria-disabled="${disabled}" title="Drag or scroll to aim · arrow keys for 1°"><i class="wheel-ticks" style="background-position-x:${-angle * 2}px"></i><i class="wheel-marker"></i></div>`;
}
export function bindAiming({ canPlay, getTank, setAim, changed, unlock }) {
  let drag = null,
    wheelDelta = 0;
  const update = (e) => {
    if (!drag || e.pointerId !== drag.id || !canPlay()) return;
    const t = getTank();
    if (drag.kind === "wheel") {
      const scale = drag.el.getBoundingClientRect().width / drag.el.offsetWidth;
      setAim(drag.angle + (e.clientX - drag.x) / scale / 2, t.power);
    } else {
      const r = drag.el.getBoundingClientRect();
      const x = ((e.clientX - r.left) * 800) / r.width;
      const y = ((e.clientY - r.top) * 600) / r.height;
      setAim((Math.atan2(t.y - 5 - y, x - t.x) * 180) / Math.PI, t.power);
    }
  };
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-angle-wheel], #scene");
    if (!el || !canPlay() || e.button !== 0) return;
    if (el.id === "scene") {
      const r = el.getBoundingClientRect(),
        y = ((e.clientY - r.top) * 600) / r.height;
      if (y < 55 || y > 430) return;
    }
    unlock();
    if (el.id !== "scene") el.focus({ preventScroll: true });
    else if (document.activeElement?.matches("input"))
      document.activeElement.blur();
    drag = {
      el,
      id: e.pointerId,
      x: e.clientX,
      angle: getTank().angle,
      kind: el.id === "scene" ? "scene" : "wheel",
    };
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    e.preventDefault();
    if (drag.kind === "scene") update(e);
  });
  document.addEventListener("pointermove", update);
  const finish = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (e.type === "pointerup") update(e);
    drag.el.classList.remove("dragging");
    drag = null;
    changed();
  };
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
  document.addEventListener("lostpointercapture", finish);
  document.addEventListener(
    "wheel",
    (e) => {
      if (!e.target.closest("[data-angle-wheel]") || !canPlay()) return;
      e.preventDefault();
      unlock();
      wheelDelta +=
        (e.deltaY || e.deltaX) *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const delta = Math.trunc(wheelDelta / 12);
      if (!delta) return;
      wheelDelta -= delta * 12;
      const t = getTank();
      setAim(t.angle + delta, t.power);
      changed();
    },
    { passive: false },
  );
  document.addEventListener("keydown", (e) => {
    if (!e.target.matches("[data-angle-wheel]")) return;
    const step = e.shiftKey ? 5 : 1;
    const delta = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: 10,
      PageDown: -10,
    }[e.key];
    if (delta === undefined || !canPlay()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const t = getTank();
    setAim(t.angle + delta, t.power);
    changed();
  });
}
