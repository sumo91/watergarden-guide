export function makeInput(canvas, onBell, onPause, onWater) {
  const keys = new Set(),
    stick = { x: 0, y: 0 },
    base = document.querySelector("#joystick"),
    knob = document.querySelector("#stick");
  let pointer = null,
    target = null;
  function clear() {
    keys.clear();
    pointer = null;
    target = null;
    stick.x = stick.y = 0;
    knob.style.transform = "";
    base.classList.remove("active");
  }
  function move(event) {
    const rect = base.getBoundingClientRect(),
      dx = event.clientX - rect.left - rect.width / 2,
      dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy),
      radius = rect.width * 0.32,
      scale = length > radius ? radius / length : 1;
    stick.x = (dx * scale) / radius;
    stick.y = (-dy * scale) / radius;
    knob.style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
  }
  base.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pointer = e.pointerId;
    target = null;
    base.setPointerCapture(pointer);
    base.classList.add("active");
    move(e);
  });
  base.addEventListener("pointermove", (e) => {
    if (e.pointerId === pointer) move(e);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    base.addEventListener(event, (e) => {
      if (e.pointerId === pointer) clear();
    });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    target = onWater(e);
  });
  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input,select,textarea")) return;
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        e.code,
      )
    )
      e.preventDefault();
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.code)
    ) {
      target = null;
      keys.add(e.code);
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.add(e.code);
    if (e.code === "Space" && !e.repeat) onBell();
    if (e.code === "Escape" && !e.repeat) onPause();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });
  return {
    clear,
    get(boat) {
      if (target) {
        const x = target.x - boat.x,
          z = target.z - boat.z,
          length = Math.hypot(x, z);
        if (length < 0.3) {
          target = null;
          return { x: 0, z: 0 };
        }
        const scale = Math.min(1, length / 1.5) / length;
        return { x: x * scale, z: z * scale };
      }
      const x =
        stick.x +
        Number(keys.has("KeyD") || keys.has("ArrowRight")) -
        Number(keys.has("KeyA") || keys.has("ArrowLeft"));
      const y =
        stick.y +
        Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown"));
      return {
        x: x * 0.846 + y * 0.533,
        z: x * 0.533 - y * 0.846,
        slow: keys.has("ShiftLeft") || keys.has("ShiftRight"),
      };
    },
  };
}
