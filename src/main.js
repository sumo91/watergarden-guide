import * as THREE from "three";
import { makeWorld, makeTraveller, makeFloatingWood } from "./world.js";
import { makeWake } from "./water.js";
import { makeWater } from "./water-optics.js";
import { makeFinish } from "./finish.js";
import { artTime } from "./materials.js";
import { makeFlora } from "./flora.js";
import { makeHut } from "./hut.js";
import { makeGameWorld } from "./game-world.js";
import { makeInput } from "./input.js";
import { makeAudio } from "./audio.js";
import {
  createGame,
  begin,
  stepGame,
  ringBell,
  groupStats,
  objective,
  serialize,
  restore,
  MISSIONS,
  REEFS,
  CURRENTS,
  SAVE_KEY,
  distance,
  constrain,
} from "./game.js";
import "./style.css";

const $ = (selector) => document.querySelector(selector);
const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};
const mobile = matchMedia("(pointer:coarse)").matches || innerWidth < 650;
let qualityName = storage.get("watergarden-quality") || "auto";
const qualities = {
  low: {
    dpr: 1,
    shadows: 1024,
    grass: 0.43,
    samples: 0,
    refraction: 0.7,
    reflection: 0.3,
    ao: false,
  },
  balanced: {
    dpr: 1.25,
    shadows: 2048,
    grass: 0.7,
    samples: 0,
    refraction: 0.85,
    reflection: 0.45,
    ao: true,
  },
  high: {
    dpr: 1.5,
    shadows: 4096,
    grass: 1,
    samples: 2,
    refraction: 1,
    reflection: 0.6,
    ao: true,
  },
};
const quality =
  qualities[qualityName] || (mobile ? qualities.low : qualities.balanced);
const canvas = $("#scene");
$("#reload").addEventListener("click", () => location.reload());
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality.samples > 0,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: mobile ? "low-power" : "high-performance",
  });
} catch {
  $("#loading").hidden = true;
  $("#fatal").hidden = false;
  $("#fatal-message").textContent =
    "这个浏览器暂时无法显示 3D 水庭。请用较新的 Safari、Chrome 或 Edge 打开。";
  throw new Error("WebGL initialization failed");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, quality.dpr));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#174b48");
const camera = new THREE.OrthographicCamera(-18, 18, 11, -11, 0.1, 150);
const focus = new THREE.Vector3(0, -0.7, 1),
  offset = new THREE.Vector3(-17, 27, 27);
camera.position.copy(focus).add(offset);
camera.lookAt(focus);
const ambient = new THREE.HemisphereLight("#c0cdcf", "#566d70", 1.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight("#ffebcc", 2.4);
sun.position.set(-17, 27, -19);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(quality.shadows);
Object.assign(sun.shadow.camera, {
  left: -30,
  right: 30,
  top: 30,
  bottom: -30,
  near: 0.5,
  far: 85,
});
sun.shadow.bias = -0.00028;
sun.shadow.normalBias = 0.075;
sun.shadow.radius = quality.shadows === 1024 ? 1.4 : 2.5;
sun.target.position.set(0, -2, 0);
scene.add(sun, sun.target);
makeWorld(scene);
const flora = makeFlora(scene, quality.grass);
makeHut(scene);
const traveller = makeTraveller(scene),
  wood = makeFloatingWood(scene),
  wake = makeWake(scene),
  garden = makeGameWorld(scene);
traveller.root.traverse((object) => {
  if (object.isMesh) object.castShadow = false;
});
const water = makeWater(renderer, scene, camera, quality),
  finish = makeFinish(renderer, camera, quality);
const audio = makeAudio();
let muted = storage.get("watergarden-muted") === "true";
audio.setMuted(muted);
let game = createGame(),
  saved = restore(storage.get(SAVE_KEY)),
  art = 0,
  last = performance.now(),
  first = true,
  autosave = 0,
  uiTime = 0,
  toastTimer,
  lastLostToast = -10,
  previousMode = "playing",
  endedRecorded = false;
const raycaster = new THREE.Raycaster(),
  waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  pointer = new THREE.Vector2();
const input = makeInput(canvas, bell, togglePause, (event) => {
  if (!["playing", "explore"].includes(game.mode)) return null;
  const rect = canvas.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    (-(event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const point = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(waterPlane, point)) {
    const destination = { x: point.x, z: point.z };
    constrain(destination, 0.45);
    return destination;
  }
  return null;
});
function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2700);
}
function save() {
  if (["title", "intro"].includes(game.mode)) return;
  storage.set(SAVE_KEY, serialize(game));
  saved = restore(storage.get(SAVE_KEY));
}
function sync() {
  document.body.dataset.mode = game.mode;
  $("#title-screen").hidden = game.mode !== "title";
  $("#intro-screen").hidden = game.mode !== "intro";
  $("#pause-screen").hidden = game.mode !== "paused";
  $("#ending-screen").hidden = game.mode !== "ending";
  $("#hud").hidden = !["playing", "paused", "explore"].includes(game.mode);
  $("#continue").hidden = !saved;
  $("#start").innerHTML = saved
    ? "重新启程 <span>↗</span>"
    : "开启旅程 <span>↗</span>";
  $("#quality").value = ["auto", "low", "balanced", "high"].includes(
    qualityName,
  )
    ? qualityName
    : "auto";
  $("#sound").textContent = muted ? "♪" : "♫";
  $("#sound").setAttribute("aria-label", muted ? "开启声音" : "关闭声音");
  if (game.mode === "ending") showEnding();
}
function newJourney() {
  audio.unlock();
  game = createGame();
  game.mode = "intro";
  input.clear();
  endedRecorded = false;
  sync();
}
function bell() {
  audio.unlock();
  if (game.mode === "explore") {
    audio.bell();
    game.bellPulse = 1.5;
    return;
  }
  if (game.mode !== "playing" || game.transition > 0 || game.bell > 0) return;
  const count = ringBell(game);
  audio.bell();
  toast(
    count
      ? `${count} 尾灵鱼听见了你。慢慢带它们回家。`
      : groupStats(game).following
        ? "铃声让鱼群安心。慢一点，它们会跟上。"
        : "再靠近灵鱼一些，让它们听见铜铃。",
  );
}
function togglePause() {
  if (game.mode === "paused") {
    game.mode = previousMode;
    input.clear();
    sync();
    return;
  }
  if (!["playing", "explore"].includes(game.mode)) return;
  previousMode = game.mode;
  game.mode = "paused";
  input.clear();
  save();
  sync();
}
function showEnding() {
  const count = game.results.reduce((n, r) => n + r.count, 0);
  $("#result-fish").textContent = count;
  $("#result-time").textContent = formatTime(game.elapsed);
  $("#result-title").textContent =
    count >= 70 ? "温柔领航者" : count >= 63 ? "引光人" : "水庭旅人";
  let best;
  try {
    best = JSON.parse(storage.get("watergarden-best"));
  } catch {}
  if (!endedRecorded) {
    if (
      !best ||
      count > best.count ||
      (count === best.count && game.elapsed < best.time)
    ) {
      best = { count, time: game.elapsed };
      storage.set("watergarden-best", JSON.stringify(best));
    }
    endedRecorded = true;
    audio.ending();
    save();
  }
  $("#best-record").textContent = best
    ? `这台设备的最佳旅程：${best.count} 尾灵鱼 · ${formatTime(best.time)}`
    : "";
}
$("#start").addEventListener("click", newJourney);
$("#replay").addEventListener("click", newJourney);
$("#sail").addEventListener("click", () => {
  audio.unlock();
  begin(game);
  input.clear();
  save();
  sync();
  toast("向菱形标记出发。靠近鱼群，再轻轻鸣铃。");
});
$("#continue").addEventListener("click", () => {
  audio.unlock();
  const loaded = restore(storage.get(SAVE_KEY));
  if (!loaded) {
    toast("未找到可用的旅程，请重新启程。");
    saved = null;
    sync();
    return;
  }
  game = loaded;
  input.clear();
  endedRecorded = false;
  sync();
});
$("#pause").addEventListener("click", togglePause);
$("#resume").addEventListener("click", togglePause);
$("#bell").addEventListener("click", bell);
$("#sound").addEventListener("click", () => {
  audio.unlock();
  muted = !muted;
  audio.setMuted(muted);
  storage.set("watergarden-muted", String(muted));
  sync();
});
$("#back-title").addEventListener("click", () => {
  save();
  game.mode = "title";
  input.clear();
  sync();
});
$("#explore").addEventListener("click", () => {
  game.mode = "explore";
  input.clear();
  sync();
  toast("灯火已经亮起。你可以在这里再停留一会儿。");
});
$("#quality").addEventListener("change", (event) => {
  save();
  storage.set("watergarden-quality", event.target.value);
  location.reload();
});
window.addEventListener("pagehide", save);
function autoPause() {
  if (["playing", "explore"].includes(game.mode)) togglePause();
}
window.addEventListener("blur", autoPause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) autoPause();
});
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  autoPause();
  renderer.setAnimationLoop(null);
  $("#fatal-message").textContent =
    "图形显示暂时中断，旅程已经保存。重新进入即可继续。";
  $("#fatal").hidden = false;
});
function resize() {
  const aspect = innerWidth / innerHeight,
    span = aspect < 1 ? 24 : 20;
  camera.left = (-span * aspect) / 2;
  camera.right = (span * aspect) / 2;
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  water.resize(size.x, size.y);
  finish.resize(size.x, size.y);
}
window.addEventListener("resize", resize);
resize();
sync();
const map = $("#minimap").getContext("2d");
function drawMap() {
  const w = 160,
    h = 224,
    xy = (p) => [18 + ((p.x + 8) / 18) * 124, 20 + ((p.z + 19) / 42) * 182];
  map.clearRect(0, 0, w, h);
  map.fillStyle = "#496757";
  map.beginPath();
  map.moveTo(5, 0);
  map.lineTo(25, 0);
  map.lineTo(18, 224);
  map.lineTo(4, 224);
  map.fill();
  map.beginPath();
  map.moveTo(136, 0);
  map.lineTo(155, 0);
  map.lineTo(155, 224);
  map.lineTo(140, 224);
  map.lineTo(129, 160);
  map.lineTo(142, 100);
  map.fill();
  map.font = "10px sans-serif";
  map.fillStyle = "#e8dab1";
  map.textAlign = "center";
  map.fillText("N", 80, 14);
  for (const c of CURRENTS) {
    const [x, y] = xy(c);
    map.strokeStyle = "#a5c3b055";
    map.beginPath();
    map.ellipse(x, y, 13, 9, -0.5, 0, Math.PI * 2);
    map.stroke();
  }
  for (const reef of REEFS) {
    const [x, y] = xy(reef);
    map.fillStyle = "#95a88b";
    map.beginPath();
    map.arc(x, y, 3, 0, Math.PI * 2);
    map.fill();
  }
  MISSIONS.forEach((m, i) => {
    const [x, y] = xy(m.home);
    map.strokeStyle = m.color;
    map.fillStyle = m.color;
    map.beginPath();
    map.arc(x, y, 4, 0, Math.PI * 2);
    if (game.results.length > i) map.fill();
    else map.stroke();
  });
  const target = objective(game),
    [tx, ty] = xy(target);
  map.strokeStyle = "#ffdf9a";
  map.lineWidth = 1.6;
  map.beginPath();
  map.moveTo(tx, ty - 6);
  map.lineTo(tx + 5, ty);
  map.lineTo(tx, ty + 6);
  map.lineTo(tx - 5, ty);
  map.closePath();
  map.stroke();
  const [x, y] = xy(game.boat);
  map.save();
  map.translate(x, y);
  map.rotate(-game.boat.angle);
  map.fillStyle = "#fff8db";
  map.beginPath();
  map.moveTo(0, -6);
  map.lineTo(4, 4);
  map.lineTo(0, 2);
  map.lineTo(-4, 4);
  map.closePath();
  map.fill();
  map.restore();
}
function updateUI() {
  const stats = groupStats(game),
    m = MISSIONS[game.mission],
    goal = objective(game),
    home = goal.kind === "home",
    near = distance(game.boat, m.home) < 3;
  $("#chapter").textContent =
    `第${["一", "二", "三"][game.mission]}程 · ${m.name}`;
  $("#objective").textContent =
    game.mode === "explore"
      ? "水庭已重新亮起"
      : game.hold > 0
        ? "静候古灯亮起"
        : home
          ? `引鱼回到${m.pool}`
          : goal.name;
  $("#task-detail").textContent =
    near && stats.home
      ? `已归位 ${stats.home} 尾。停在灯池旁，等鱼群游进石环。`
      : stats.lost
        ? `${stats.lost} 尾灵鱼掉队了。回头鸣铃，就能找回它们。`
        : home
          ? "跟着菱形标记慢划。进入石环后停一停。"
          : "靠近鱼群 6 米以内，轻轻摇响铜铃。";
  $("#fish-count").textContent =
    `随行 ${stats.following} · 归位 ${stats.home} / 24`;
  $("#fish-progress").style.width =
    `${((stats.following + stats.home) / 24) * 100}%`;
  $("#journey-time").textContent = formatTime(game.elapsed);
  $("#lanterns").setAttribute(
    "aria-label",
    `已点亮 ${game.results.length} 盏灯`,
  );
  $("#lanterns")
    .querySelectorAll("i")
    .forEach((e, i) => e.classList.toggle("lit", i < game.results.length));
  $("#bell").disabled = game.bell > 0 || game.transition > 0;
  $("#bell span").textContent =
    game.bell > 0 ? `${game.bell.toFixed(1)}s` : "鸣铃";
  $("#current-warning").hidden = !game.inCurrent;
  $("#chapter-message").hidden = game.transition <= 0;
  if (game.transition > 0) $("#chapter-story").textContent = m.story;
  drawMap();
}
function placeWaypoint() {
  const goal = objective(game),
    p = new THREE.Vector3(goal.x, 0.35, goal.z).project(camera);
  let x = (p.x * 0.5 + 0.5) * innerWidth,
    y = (-p.y * 0.5 + 0.5) * innerHeight;
  const outside =
    x < 35 || x > innerWidth - 35 || y < 90 || y > innerHeight - 165;
  const direction = Math.round(
    Math.atan2(x - innerWidth / 2, innerHeight / 2 - y) / (Math.PI / 4),
  );
  $(".waypoint-glyph").textContent = outside
    ? ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][(direction + 8) % 8]
    : "◇";
  x = Math.max(76, Math.min(innerWidth - 76, x));
  y = Math.max(92, Math.min(innerHeight - 165, y));
  const q = $(".quest-card").getBoundingClientRect();
  if (x < q.right + 30 && y < q.bottom + 50) y = q.bottom + 65;
  const mapBounds = $("#minimap").getBoundingClientRect();
  if (x > mapBounds.left - 45 && y < mapBounds.bottom + 50)
    y = mapBounds.bottom + 62;
  $("#waypoint").style.left = `${x}px`;
  $("#waypoint").style.top = `${y}px`;
  $("#waypoint").style.opacity = game.transition > 0 ? "0" : "1";
  $("#waypoint-text").textContent =
    `${goal.kind === "home" ? MISSIONS[game.mission].pool : "灵鱼"} · ${Math.round(distance(game.boat, goal))}m`;
}
let frameCount = 0,
  frameWindow = 0,
  lowered = false;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const animated = !["paused", "intro"].includes(game.mode);
  if (animated) art += dt;
  const before = game.mode;
  stepGame(game, dt, input.get(game.boat));
  if (before !== game.mode) sync();
  for (const event of game.events) {
    if (event.type === "lost" && game.elapsed - lastLostToast > 8) {
      lastLostToast = game.elapsed;
      toast("有灵鱼掉队了。停下、回头，再摇一摇铜铃。");
    }
    if (event.type === "restored") {
      audio.restored();
      input.clear();
      save();
    }
    if (event.type === "mission") {
      input.clear();
      save();
      toast("下一群灵鱼在等你。沿着新的菱形标记出发。");
    }
  }
  game.events.length = 0;
  const active = ["playing", "paused", "explore"].includes(game.mode),
    ending = game.mode === "ending";
  const desired = active
    ? new THREE.Vector3(
        game.boat.x + game.boat.vx * 0.5,
        -0.4,
        game.boat.z + game.boat.vz * 0.5,
      )
    : ending
      ? new THREE.Vector3(1, -0.7, -1)
      : new THREE.Vector3(0, -0.7, 1);
  focus.lerp(desired, 1 - Math.exp(-dt * (active ? 2.8 : 0.8)));
  camera.position.copy(focus).addScaledVector(offset, ending ? 1.12 : 1);
  camera.lookAt(focus);
  camera.updateMatrixWorld();
  const zoom = ending ? 0.76 : active ? 1 : 1.03;
  camera.zoom += (zoom - camera.zoom) * (1 - Math.exp(-dt));
  camera.updateProjectionMatrix();
  traveller.update(art, game.boat);
  wood.update(art);
  wake.update(art, game.boat);
  flora.update(art);
  garden.update(game, art);
  artTime.value = art;
  water.uniforms.clarity.value = 0.55 + game.results.length * 0.1;
  water.render(art, [wake.group, ...garden.hidden], finish.target);
  finish.render();
  if (first) {
    first = false;
    renderer.shadowMap.autoUpdate = false;
    $("#loading").classList.add("ready");
    setTimeout(() => $("#loading").remove(), 700);
    game.mode = "title";
    sync();
  }
  uiTime += dt;
  if (uiTime > 0.1) {
    updateUI();
    uiTime = 0;
  }
  if (active) placeWaypoint();
  autosave += dt;
  if (autosave > 3) {
    save();
    autosave = 0;
  }
  frameCount++;
  frameWindow += dt;
  if (frameWindow > 5) {
    const fps = frameCount / frameWindow;
    if (
      qualityName === "auto" &&
      !lowered &&
      fps < 27 &&
      renderer.getPixelRatio() > 0.8
    ) {
      renderer.setPixelRatio(0.8);
      resize();
      lowered = true;
    }
    frameCount = 0;
    frameWindow = 0;
  }
}
renderer.setAnimationLoop(frame);
