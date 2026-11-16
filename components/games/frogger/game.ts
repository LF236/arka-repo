import { DEFAULT_SKIN, resolveSkin, type SkinId } from "@/lib/skins";
import { PALETTES, AVAILABLE_SKINS, type Palette } from "./skins";

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setSkin: (id: SkinId) => void;
}

const COLS = 16;
const ROWS = 14;
const CELL = 40;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;
const START_COL = 8;
const GOAL_COLS = [1, 4, 7, 10, 13];
const JUMP_MS = 120;

const MAX_DT = 50;
const BASE_SPEED_SCALE = 0.7; // atenúa las velocidades base para que sea jugable
const SPEED_PER_LEVEL = 0.15;
const MAX_SPEED_MULT = 2.5;
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
const DASH_ROAD: number[] = [16, 14];
const DASH_CLEAR: number[] = [];

interface Entity {
  x: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  phase?: number;
}

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  period: number; // celdas; longitud del ciclo de reaparición
  entities: Entity[];
}

type Direction = "up" | "down" | "left" | "right";

interface Frog {
  x: number; // celdas, float; borde izquierdo
  row: number; // fila lógica (la de destino se asigna al terminar el salto)
  animating: boolean;
  animT: number; // ms
  fromX: number;
  fromRow: number;
  targetX: number;
  targetRow: number;
}

const DIR_DELTA: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

interface LaneConfig {
  row: number;
  type: Entity["type"];
  width: number;
  gap: number;
  speed: number; // celdas/s base (nivel 1)
  dir: 1 | -1;
  offset: number; // desfase inicial en celdas
}

const LANE_CONFIGS: LaneConfig[] = [
  // Río (filas 1–6)
  { row: 1, type: "turtle", width: 2, gap: 3, speed: 2, dir: -1, offset: 0 },
  { row: 2, type: "log", width: 3, gap: 4, speed: 3, dir: 1, offset: 2 },
  { row: 3, type: "log", width: 5, gap: 4, speed: 4.5, dir: 1, offset: 1 },
  { row: 4, type: "turtle", width: 3, gap: 3, speed: 2.5, dir: -1, offset: 3 },
  { row: 5, type: "log", width: 4, gap: 3, speed: 1.5, dir: -1, offset: 0 },
  { row: 6, type: "turtle", width: 2, gap: 4, speed: 3.5, dir: 1, offset: 2 },
  // Carretera (filas 8–12)
  { row: 8, type: "car", width: 1, gap: 4, speed: 3, dir: -1, offset: 0 },
  { row: 9, type: "truck", width: 2, gap: 5, speed: 2.25, dir: 1, offset: 3 },
  { row: 10, type: "car", width: 1, gap: 3, speed: 4, dir: -1, offset: 1 },
  { row: 11, type: "car", width: 1, gap: 5, speed: 6, dir: 1, offset: 2 },
  { row: 12, type: "truck", width: 3, gap: 5, speed: 2.5, dir: -1, offset: 4 },
];

let COLORS: Palette = PALETTES[DEFAULT_SKIN] as Palette;

function speedMult(level: number): number {
  return Math.min(MAX_SPEED_MULT, 1 + SPEED_PER_LEVEL * (level - 1));
}

function buildLanes(level: number): Lane[] {
  const mult = speedMult(level);
  return LANE_CONFIGS.map((cfg) => {
    const slot = cfg.width + cfg.gap;
    const n = Math.max(2, Math.ceil((COLS + cfg.width) / slot));
    const entities: Entity[] = [];
    for (let i = 0; i < n; i++) {
      const e: Entity = {
        x: cfg.offset + i * slot - cfg.width,
        width: cfg.width,
        type: cfg.type,
      };
      if (cfg.type === "turtle") {
        e.phase = Math.random() * TURTLE_CYCLE_MS;
        e.submerged = e.phase >= TURTLE_VISIBLE_MS;
      }
      entities.push(e);
    }
    return {
      row: cfg.row,
      speed: cfg.speed * BASE_SPEED_SCALE * mult,
      dir: cfg.dir,
      period: n * slot,
      entities,
    };
  });
}

function indexLanes(lanes: Lane[]): Map<number, Lane> {
  const m = new Map<number, Lane>();
  for (const l of lanes) m.set(l.row, l);
  return m;
}

function updateLanes(lanes: Lane[], dt: number) {
  for (const lane of lanes) {
    const dx = (lane.speed * lane.dir * dt) / 1000;
    for (const e of lane.entities) {
      e.x += dx;
      if (lane.dir === 1 && e.x >= COLS) e.x -= lane.period;
      else if (lane.dir === -1 && e.x + e.width <= 0) e.x += lane.period;
      if (e.type === "turtle") {
        e.phase = ((e.phase ?? 0) + dt) % TURTLE_CYCLE_MS;
        e.submerged = e.phase >= TURTLE_VISIBLE_MS;
      }
    }
  }
}

function drawZones(ctx: CanvasRenderingContext2D) {
  // Bocas / orilla superior
  ctx.fillStyle = COLORS.goalBank;
  ctx.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);
  ctx.fillStyle = COLORS.mouth;
  for (const c of GOAL_COLS) {
    ctx.fillRect(c * CELL + 2, ROW_GOALS * CELL + 4, 2 * CELL - 4, CELL - 8);
  }
  // Río
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(
    0,
    ROW_RIVER_TOP * CELL,
    CANVAS_W,
    (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
  );
  // Zona segura central
  ctx.fillStyle = COLORS.safe;
  ctx.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);
  // Carretera
  ctx.fillStyle = COLORS.road;
  ctx.fillRect(
    0,
    ROW_ROAD_TOP * CELL,
    CANVAS_W,
    (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
  );
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash(DASH_ROAD);
  for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(CANVAS_W, r * CELL);
    ctx.stroke();
  }
  ctx.setLineDash(DASH_CLEAR);
  // Zona de inicio
  ctx.fillStyle = COLORS.start;
  ctx.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);
}

function glowColor(type: Entity["type"], idx: number): string {
  switch (type) {
    case "car":
      return COLORS.cars[idx % COLORS.cars.length];
    case "truck":
      return COLORS.truck;
    case "log":
      return COLORS.log;
    default:
      return COLORS.turtleShell;
  }
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  row: number,
  idx: number,
) {
  drawEntityAt(
    ctx,
    e.type,
    e.width,
    !!e.submerged,
    e.x * CELL,
    row * CELL,
    idx,
  );
}

function drawEntityAt(
  ctx: CanvasRenderingContext2D,
  type: Entity["type"],
  width: number,
  submerged: boolean,
  x: number,
  y: number,
  idx: number,
) {
  const w = width * CELL;
  ctx.shadowColor = glowColor(type, idx);
  ctx.shadowBlur = COLORS.glow;
  switch (type) {
    case "car": {
      ctx.fillStyle = COLORS.cars[idx % COLORS.cars.length];
      ctx.fillRect(x + 3, y + 8, w - 6, CELL - 16);
      ctx.fillStyle = COLORS.carWindow;
      ctx.fillRect(x + w * 0.55, y + 11, w * 0.22, CELL - 22);
      break;
    }
    case "truck": {
      ctx.fillStyle = COLORS.truck;
      ctx.fillRect(x + 3, y + 6, w - 6, CELL - 12);
      ctx.fillStyle = COLORS.truckCab;
      ctx.fillRect(x + w - 16, y + 9, 10, CELL - 18);
      break;
    }
    case "log": {
      ctx.fillStyle = COLORS.log;
      ctx.fillRect(x + 1, y + 6, w - 2, CELL - 12);
      ctx.fillStyle = COLORS.logDark;
      for (let i = 1; i < width * 2; i++) {
        ctx.fillRect(x + (i * CELL) / 2, y + 6, 2, CELL - 12);
      }
      break;
    }
    case "turtle": {
      ctx.globalAlpha = submerged ? 0.3 : 1;
      for (let i = 0; i < width; i++) {
        const cx = x + i * CELL + CELL / 2;
        const cy = y + CELL / 2;
        ctx.fillStyle = COLORS.turtleShell;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.turtle;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
  ctx.shadowBlur = 0;
}

/** Margen del sprite para que el blur (glow) no se recorte. */
const SPRITE_PAD = 32;

type SpriteCache = Map<string, HTMLCanvasElement>;

function spriteKey(type: Entity["type"], width: number, idx: number): string {
  return type === "car" ? `car:${width}:${idx}` : `${type}:${width}`;
}

/** Pre-renderiza cada variante de entidad con el glow horneado. null si el skin no tiene glow. */
function buildSpriteCache(): SpriteCache | null {
  if (COLORS.glow <= 0) return null;
  const cache: SpriteCache = new Map();
  const make = (type: Entity["type"], width: number, idx: number) => {
    const key = spriteKey(type, width, idx);
    if (cache.has(key)) return;
    const c = document.createElement("canvas");
    c.width = width * CELL + 2 * SPRITE_PAD;
    c.height = CELL + 2 * SPRITE_PAD;
    const sctx = c.getContext("2d") as CanvasRenderingContext2D;
    drawEntityAt(sctx, type, width, false, SPRITE_PAD, SPRITE_PAD, idx);
    cache.set(key, c);
  };
  for (const cfg of LANE_CONFIGS) {
    if (cfg.type === "car") {
      for (let i = 0; i < COLORS.cars.length; i++) make("car", cfg.width, i);
    } else {
      make(cfg.type, cfg.width, 0);
    }
  }
  return cache;
}

function createFrog(): Frog {
  return {
    x: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    fromX: START_COL,
    fromRow: ROW_START,
    targetX: START_COL,
    targetRow: ROW_START,
  };
}

function startJump(frog: Frog, dir: Direction) {
  const [dx, dy] = DIR_DELTA[dir];
  const fromX = Math.round(frog.x);
  frog.fromX = fromX;
  frog.fromRow = frog.row;
  frog.targetX = Math.max(0, Math.min(COLS - 1, fromX + dx));
  frog.targetRow = Math.max(ROW_GOALS, Math.min(ROW_START, frog.row + dy));
  frog.animT = 0;
  frog.animating = true;
}

/** Avanza la animación del salto. Devuelve true si el salto terminó en este frame. */
function updateFrogJump(frog: Frog, dt: number): boolean {
  if (!frog.animating) return false;
  frog.animT += dt;
  const t = Math.min(1, frog.animT / JUMP_MS);
  frog.x = frog.fromX + (frog.targetX - frog.fromX) * t;
  if (t >= 1) {
    frog.x = frog.targetX;
    frog.row = frog.targetRow;
    frog.animating = false;
    return true;
  }
  return false;
}

function roundTimeMs(level: number): number {
  return Math.max(8, 16 - level) * 1000;
}

/** Fila en la que cuenta la rana para colisiones (durante el salto, la más cercana). */
function effectiveRow(frog: Frog): number {
  if (!frog.animating) return frog.row;
  return frog.animT / JUMP_MS < 0.5 ? frog.fromRow : frog.targetRow;
}

function checkRoadCollision(
  frog: Frog,
  laneByRow: Map<number, Lane>,
): boolean {
  const row = effectiveRow(frog);
  if (row < ROW_ROAD_TOP || row > ROW_ROAD_BOT) return false;
  const lane = laneByRow.get(row);
  if (!lane) return false;
  const left = frog.x + 0.15;
  const right = frog.x + 0.85;
  return lane.entities.some((e) => left < e.x + e.width && right > e.x);
}

/** Entidad que sostiene a la rana en un carril de río (tortugas sumergidas no sostienen). */
function getSupport(frog: Frog, lane: Lane): Entity | null {
  const center = frog.x + 0.5;
  for (const e of lane.entities) {
    if (e.submerged) continue;
    if (center >= e.x && center < e.x + e.width) return e;
  }
  return null;
}

function drawFrog(ctx: CanvasRenderingContext2D, frog: Frog) {
  let row = frog.row;
  let lift = 0;
  if (frog.animating) {
    const t = Math.min(1, frog.animT / JUMP_MS);
    row = frog.fromRow + (frog.targetRow - frog.fromRow) * t;
    lift = Math.sin(t * Math.PI) * 4;
  }
  drawFrogAt(ctx, frog.x, row, lift);
}

function drawFrogAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  row: number,
  lift = 0,
) {
  const cx = x * CELL + CELL / 2;
  const cy = row * CELL + CELL / 2 - lift;
  ctx.shadowColor = COLORS.frog;
  ctx.shadowBlur = COLORS.glow;
  ctx.fillStyle = COLORS.frogDark;
  ctx.fillRect(cx - 14, cy - 3, 6, 8);
  ctx.fillRect(cx + 8, cy - 3, 6, 8);
  ctx.fillStyle = COLORS.frog;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, 11, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.frogEye;
  ctx.beginPath();
  ctx.arc(cx - 5, cy - 8, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + 5, cy - 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.frogPupil;
  ctx.beginPath();
  ctx.arc(cx - 5, cy - 8.5, 1.5, 0, Math.PI * 2);
  ctx.arc(cx + 5, cy - 8.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  score: number,
  level: number,
  lives: number,
  timeRatio: number,
) {
  const y = ROW_START * CELL;
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 16px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE ${String(score).padStart(5, "0")}`, 12, y + 17);
  ctx.textAlign = "center";
  ctx.fillText(`NIVEL ${level}`, CANVAS_W / 2, y + 17);
  ctx.textAlign = "right";
  ctx.fillText(`VIDAS ${lives}`, CANVAS_W - 12, y + 17);
  // Barra de tiempo en el borde inferior
  const barH = 6;
  const ratio = Math.max(0, Math.min(1, timeRatio));
  ctx.fillStyle = ratio < 0.25 ? COLORS.timeBarLow : COLORS.timeBar;
  ctx.fillRect(0, CANVAS_H - barH, CANVAS_W * ratio, barH);
}

export function initGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: { skin?: SkinId },
): GameController {
  COLORS = PALETTES[
    resolveSkin(options?.skin ?? DEFAULT_SKIN, AVAILABLE_SKINS)
  ] as Palette;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  let level = 1;
  let score = 0;
  let lives = 3;
  let lanes = buildLanes(level);
  let laneByRow = indexLanes(lanes);
  let sprites = buildSpriteCache();
  let timeMax = roundTimeMs(level);
  let timeLeft = timeMax;
  let bestRow = ROW_START;
  const filled: boolean[] = GOAL_COLS.map(() => false);
  let over = false;
  const frog = createFrog();
  let pendingDir: Direction | null = null;
  let paused = false;
  let rafId = 0;
  let lastTime = 0;

  function onKeyDown(e: KeyboardEvent) {
    const dir = KEY_DIR[e.key];
    if (!dir) return;
    e.preventDefault();
    if (paused) return;
    pendingDir = dir;
  }
  document.addEventListener("keydown", onKeyDown);
  callbacks.onLevel(level);

  function addScore(points: number) {
    score += points;
    callbacks.onScore(score);
  }

  function respawn() {
    Object.assign(frog, createFrog());
    pendingDir = null;
    bestRow = ROW_START;
    timeLeft = timeMax;
  }

  function killFrog() {
    lives -= 1;
    callbacks.onLives(lives);
    pendingDir = null;
    if (lives <= 0) {
      over = true;
      callbacks.onGameOver(score);
      return;
    }
    respawn();
  }

  function completeRound() {
    addScore(200);
    level += 1;
    callbacks.onLevel(level);
    filled.fill(false);
    lanes = buildLanes(level);
    laneByRow = indexLanes(lanes);
    timeMax = roundTimeMs(level);
    respawn();
  }

  /** Devuelve true si la rana llegó a la fila de bocas (acierte o muera). */
  function checkGoal(): boolean {
    if (frog.animating || frog.row !== ROW_GOALS) return false;
    const center = frog.x + 0.5;
    const idx = GOAL_COLS.findIndex((c) => center >= c && center < c + 2);
    if (idx === -1 || filled[idx]) {
      killFrog();
      return true;
    }
    filled[idx] = true;
    addScore(50 + Math.floor(timeLeft / 1000) * 10);
    if (filled.every(Boolean)) completeRound();
    else respawn();
    return true;
  }

  function update(dt: number) {
    if (over) return;
    updateLanes(lanes, dt);
    updateFrogJump(frog, dt);

    if (!frog.animating && frog.row < bestRow) {
      addScore((bestRow - frog.row) * 10);
      bestRow = frog.row;
    }
    if (checkGoal()) return;

    if (checkRoadCollision(frog, laneByRow)) {
      killFrog();
      return;
    }

    // Río: soporte, arrastre y muerte por agua
    if (
      !frog.animating &&
      frog.row >= ROW_RIVER_TOP &&
      frog.row <= ROW_RIVER_BOT
    ) {
      const lane = laneByRow.get(frog.row);
      const support = lane ? getSupport(frog, lane) : null;
      if (!lane || !support) {
        killFrog();
        return;
      }
      frog.x += (lane.speed * lane.dir * dt) / 1000;
      const center = frog.x + 0.5;
      if (center < 0 || center >= COLS) {
        killFrog();
        return;
      }
    }

    timeLeft -= dt;
    if (timeLeft <= 0) {
      killFrog();
      return;
    }

    if (!frog.animating && pendingDir) {
      startJump(frog, pendingDir);
      pendingDir = null;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawZones(ctx);
    for (const lane of lanes) {
      const ents = lane.entities;
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i];
        const sprite = sprites?.get(
          spriteKey(e.type, e.width, i % COLORS.cars.length),
        );
        if (sprite) {
          if (e.submerged) ctx.globalAlpha = 0.3;
          ctx.drawImage(
            sprite,
            e.x * CELL - SPRITE_PAD,
            lane.row * CELL - SPRITE_PAD,
          );
          if (e.submerged) ctx.globalAlpha = 1;
        } else {
          drawEntity(ctx, e, lane.row, i);
        }
      }
    }
    for (let i = 0; i < filled.length; i++) {
      if (filled[i]) drawFrogAt(ctx, GOAL_COLS[i] + 0.5, ROW_GOALS);
    }
    drawFrog(ctx, frog);
    drawHud(ctx, score, level, Math.max(0, lives), timeLeft / timeMax);
  }

  function frame(now: number) {
    const dt = Math.min(MAX_DT, now - lastTime);
    lastTime = now;
    if (paused) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    update(dt);
    draw();
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame((t) => {
    lastTime = t;
    frame(t);
  });

  return {
    setSkin: (id) => {
      COLORS = PALETTES[resolveSkin(id, AVAILABLE_SKINS)] as Palette;
      sprites = buildSpriteCache();
      draw();
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      lastTime = performance.now();
    },
    destroy: () => {
      cancelAnimationFrame(rafId);
      sprites = null;
      document.removeEventListener("keydown", onKeyDown);
    },
  };
}
