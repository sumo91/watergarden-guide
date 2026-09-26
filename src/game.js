export const SAVE_KEY = "watergarden-guide-v1";
export const MISSIONS = [
  {
    name: "码头的晨光",
    school: { x: 3, z: 12 },
    home: { x: -5.4, z: 4 },
    color: "#f1c979",
    pool: "小屋灯池",
    story: "第一盏灯亮了。码头旁的睡莲，记起了春天。",
  },
  {
    name: "芦苇的低语",
    school: { x: 7.2, z: -1 },
    home: { x: 7, z: 16 },
    color: "#b3e4ac",
    pool: "芦苇灯池",
    story: "第二盏灯亮了。风穿过芦苇，水庭有了呼吸。",
  },
  {
    name: "遗迹的回声",
    school: { x: -4.3, z: -15 },
    home: { x: 5, z: -12.5 },
    color: "#b8d9f1",
    pool: "回声灯池",
    story: "最后一盏灯亮了。迷路的光，终于回到了水庭。",
  },
];
export const REEFS = [
  { x: -1, z: 10, r: 1.05 },
  { x: 3.2, z: 3.8, r: 0.9 },
  { x: -2.8, z: -5.4, r: 1.15 },
  { x: 2.4, z: -7.8, r: 0.88 },
  { x: 8.2, z: -7.8, r: 0.88 },
];
export const CURRENTS = [
  { x: 2.6, z: 7.2, r: 3.3, dx: 0.85, dz: 0.25 },
  { x: 1.1, z: -10, r: 3.2, dx: -0.45, dz: -0.8 },
];
export const FISH_COUNT = 24;
export const REQUIRED = 18;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (x) => Number.isFinite(x);
function freshFish() {
  return MISSIONS.flatMap((mission, group) =>
    Array.from({ length: FISH_COUNT }, (_, id) => {
      const phase = id * 2.399963;
      return {
        group,
        id,
        x: mission.school.x + Math.cos(phase) * (1 + (id % 5) * 0.2),
        z: mission.school.z + Math.sin(phase) * (1 + (id % 4) * 0.2),
        state: "idle",
        lag: 0,
        angle: phase,
      };
    }),
  );
}
export function createGame() {
  return {
    version: 1,
    mode: "title",
    mission: 0,
    elapsed: 0,
    bell: 0,
    bellPulse: 0,
    calls: 0,
    hold: 0,
    transition: 0,
    inCurrent: false,
    lost: 0,
    boat: { x: -5.4, z: 7.1, vx: 0, vz: 0, angle: -0.17 },
    fish: freshFish(),
    results: [],
    events: [],
  };
}
export function begin(game) {
  game.mode = "playing";
  game.events.push({ type: "start" });
}
export function groupStats(game) {
  const fish = game.fish.filter((f) => f.group === game.mission);
  return {
    following: fish.filter((f) => f.state === "following").length,
    home: fish.filter((f) => f.state === "home").length,
    lost: fish.filter((f) => f.state === "lost").length,
  };
}
export function objective(game) {
  const m = MISSIONS[Math.min(game.mission, 2)],
    stats = groupStats(game);
  if (stats.following + stats.home >= REQUIRED)
    return { ...m.home, kind: "home", name: m.pool };
  const stray = game.fish
    .filter(
      (f) =>
        f.group === game.mission && (f.state === "lost" || f.state === "idle"),
    )
    .sort((a, b) => distance(a, game.boat) - distance(b, game.boat))[0];
  return {
    x: stray?.x ?? m.school.x,
    z: stray?.z ?? m.school.z,
    kind: "school",
    name: stats.lost ? "找回掉队的灵鱼" : "寻找灵鱼",
  };
}
export function ringBell(game) {
  if (game.mode !== "playing" || game.transition > 0 || game.bell > 0) return 0;
  game.bell = 1.7;
  game.bellPulse = 1.5;
  game.calls++;
  let gathered = 0;
  for (const fish of game.fish) {
    if (fish.group !== game.mission || fish.state === "home") continue;
    if (distance(fish, game.boat) < 5.8) {
      if (fish.state !== "following") gathered++;
      fish.state = "following";
      fish.lag = 0;
    }
  }
  game.events.push({ type: "bell", count: gathered });
  return gathered;
}
export function constrain(point, radius = 0.4) {
  point.x = clamp(point.x, -7.5 + radius, 9.55 - radius);
  point.z = clamp(point.z, -18.6 + radius, 22 - radius);
  // The first five quay steps protrude above water. Slide along their three
  // exposed edges; the fourth edge is joined to the non-navigable bank.
  const stairX = -5.55,
    stairNear = 11.25,
    stairFar = 15.95;
  if (
    point.x < stairX + radius &&
    point.z > stairNear - radius &&
    point.z < stairFar + radius
  ) {
    const options = [
      { distance: stairX + radius - point.x, x: stairX + radius, z: point.z },
      {
        distance: point.z - stairNear + radius,
        x: point.x,
        z: stairNear - radius,
      },
      {
        distance: stairFar + radius - point.z,
        x: point.x,
        z: stairFar + radius,
      },
    ].sort((a, b) => a.distance - b.distance);
    point.x = options[0].x;
    point.z = options[0].z;
  }
  for (const reef of REEFS) {
    const dx = point.x - reef.x,
      dz = point.z - reef.z,
      d = Math.hypot(dx, dz),
      min = reef.r + radius;
    if (d < min) {
      point.x = reef.x + (d > 0.0001 ? dx / d : 1) * min;
      point.z = reef.z + (d > 0.0001 ? dz / d : 0) * min;
    }
  }
}
function currentAt(point) {
  let x = 0,
    z = 0;
  for (const c of CURRENTS) {
    const strength = Math.max(0, 1 - distance(c, point) / c.r);
    x += c.dx * strength;
    z += c.dz * strength;
  }
  return { x, z };
}
export function stepGame(game, dt, input = { x: 0, z: 0 }) {
  if (!["playing", "explore"].includes(game.mode)) return;
  dt = clamp(dt, 0, 0.05);
  if (game.mode === "playing") game.elapsed += dt;
  game.bell = Math.max(0, game.bell - dt);
  game.bellPulse = Math.max(0, game.bellPulse - dt);
  if (game.transition > 0) {
    game.transition = Math.max(0, game.transition - dt);
    if (game.transition <= 0) {
      if (game.mission === 2) {
        game.mode = "ending";
        game.events.push({ type: "ending" });
      } else {
        game.mission++;
        game.hold = 0;
        game.events.push({ type: "mission" });
      }
    }
    return;
  }
  const boat = game.boat,
    length = Math.hypot(input.x, input.z),
    scale = length > 1 ? 1 / length : 1;
  const slow = input.slow || game.bellPulse > 0.8;
  const speed = slow ? 1.45 : 2.9;
  const blend = 1 - Math.exp(-dt * 5);
  const drift = currentAt(boat);
  game.inCurrent = Math.hypot(drift.x, drift.z) > 0.2;
  boat.vx += ((input.x || 0) * scale * speed + drift.x - boat.vx) * blend;
  boat.vz += ((input.z || 0) * scale * speed + drift.z - boat.vz) * blend;
  boat.x += boat.vx * dt;
  boat.z += boat.vz * dt;
  constrain(boat);
  if (Math.hypot(boat.vx, boat.vz) > 0.08) {
    const a = Math.atan2(-boat.vx, -boat.vz),
      delta = Math.atan2(Math.sin(a - boat.angle), Math.cos(a - boat.angle));
    boat.angle += delta * (1 - Math.exp(-dt * 5));
  }
  // Two end caps keep the long hull out of obstacles even during a turn.
  for (let pass = 0; pass < 2; pass++)
    for (const side of [-1, 1]) {
      const dx = Math.sin(boat.angle) * 0.62 * side,
        dz = Math.cos(boat.angle) * 0.62 * side;
      const cap = { x: boat.x + dx, z: boat.z + dz };
      constrain(cap, 0.35);
      boat.x += cap.x - (boat.x + dx);
      boat.z += cap.z - (boat.z + dz);
    }
  const home = MISSIONS[game.mission].home;
  for (const f of game.fish) {
    const phase = f.id * 2.399963,
      active = f.group === game.mission;
    let target,
      swim = 1.1;
    if (f.state === "home") {
      const h = MISSIONS[f.group].home,
        a = phase + game.elapsed * 0.32;
      target = {
        x: h.x + Math.cos(a) * (1.25 + (f.id % 3) * 0.18),
        z: h.z + Math.sin(a) * (1.25 + (f.id % 3) * 0.18),
      };
    } else if (active && f.state === "following") {
      const backX = Math.sin(boat.angle),
        backZ = Math.cos(boat.angle),
        trail = 0.9 + (f.id / FISH_COUNT) * 2.8;
      const side = Math.sin(phase) * (0.45 + (f.id / FISH_COUNT) * 0.8);
      target = {
        x: boat.x + backX * trail + backZ * side,
        z: boat.z + backZ * trail - backX * side,
      };
      swim = game.bellPulse > 0 ? 4 : 2.5;
      if (distance(f, boat) > 6.2) f.lag += dt;
      else f.lag = Math.max(0, f.lag - dt * 2);
      if (f.lag > 2.2) {
        f.state = "lost";
        game.lost++;
        game.events.push({ type: "lost" });
      }
      if (distance(boat, home) < 2.5) {
        target = home;
        swim = 3.6;
      }
      if (distance(f, home) < 2.5 && distance(boat, home) < 3.2) {
        f.state = "home";
        game.events.push({ type: "arrived" });
      }
    } else if (f.state === "lost") {
      target = {
        x: f.x + Math.cos(game.elapsed + phase) * 0.06,
        z: f.z + Math.sin(game.elapsed + phase) * 0.06,
      };
      swim = 0.2;
    } else {
      const s = MISSIONS[f.group].school,
        a = phase + game.elapsed * 0.28;
      target = {
        x: s.x + Math.cos(a) * (1 + (f.id % 5) * 0.18),
        z: s.z + Math.sin(a) * (1 + (f.id % 4) * 0.17),
      };
    }
    const dx = target.x - f.x,
      dz = target.z - f.z,
      d = Math.hypot(dx, dz);
    if (d > 0.03) {
      const movement = Math.min(d, swim * dt);
      f.x += (dx / d) * movement;
      f.z += (dz / d) * movement;
      f.angle = Math.atan2(-dx, -dz);
    }
    if (f.state === "following") {
      const flow = currentAt(f);
      f.x += flow.x * dt * 0.55;
      f.z += flow.z * dt * 0.55;
    }
    constrain(f, 0.13);
  }
  if (game.mode === "explore") return;
  const stats = groupStats(game);
  if (stats.home >= REQUIRED && distance(boat, home) < 3) game.hold += dt;
  else game.hold = Math.max(0, game.hold - dt);
  if (game.hold >= 2.5) {
    game.results.push({ count: stats.home, time: game.elapsed });
    for (const fish of game.fish)
      if (fish.group === game.mission) fish.state = "home";
    game.transition = 3.8;
    game.boat.vx = 0;
    game.boat.vz = 0;
    game.events.push({ type: "restored", mission: game.mission });
  }
}
export function serialize(game) {
  const { events, ...data } = game;
  return JSON.stringify(data);
}
export function restore(raw) {
  try {
    const data = JSON.parse(raw);
    if (
      data.version !== 1 ||
      !Number.isInteger(data.mission) ||
      data.mission < 0 ||
      data.mission > 2 ||
      !finite(data.elapsed) ||
      data.elapsed < 0
    )
      return null;
    if (
      !data.boat ||
      !["x", "z", "vx", "vz", "angle"].every((k) => finite(data.boat[k]))
    )
      return null;
    if (
      !Array.isArray(data.fish) ||
      data.fish.length !== 72 ||
      !data.fish.every(
        (f, i) =>
          f.group === Math.floor(i / 24) &&
          f.id === i % 24 &&
          ["x", "z", "angle", "lag"].every((k) => finite(f[k])) &&
          ["idle", "following", "home", "lost"].includes(f.state),
      )
    )
      return null;
    if (
      !Array.isArray(data.results) ||
      data.results.length > 3 ||
      !data.results.every(
        (r) =>
          Number.isInteger(r.count) &&
          r.count >= REQUIRED &&
          r.count <= 24 &&
          finite(r.time),
      )
    )
      return null;
    for (const key of [
      "bell",
      "bellPulse",
      "calls",
      "hold",
      "transition",
      "lost",
    ])
      if (!finite(data[key]) || data[key] < 0) return null;
    if (
      data.results.length < data.mission ||
      data.results.length > data.mission + 1
    )
      return null;
    constrain(data.boat);
    data.mode =
      data.results.length === 3 && data.transition <= 0 ? "ending" : "playing";
    data.events = [];
    return data;
  } catch {
    return null;
  }
}
