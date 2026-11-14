export interface GameCallbacks {
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

const CELL = 25;
const COLS = 32;
const ROWS = 32;
const INITIAL_INTERVAL = 150;
const SPEED_STEP = 5;
const SPEED_FACTOR = 0.95;
const MIN_INTERVAL = 50;
const POINTS_PER_FRUIT = 10;

const FRUIT_TYPES = [
  "banana",
  "orange",
  "grape",
  "garlic",
  "eggplant",
  "strawberry",
  "cherry",
  "carrot",
  "mushroom",
  "broccoli",
  "watermelon",
  "pepper",
  "kiwi",
  "lemon",
  "peach",
  "peanut",
  "apple",
  "tomato",
  "berries",
  "grapes2",
  "pineapple",
  "melon",
] as const;

type FruitType = (typeof FRUIT_TYPES)[number];

interface Sprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SPRITE_ATLAS: Record<FruitType, Sprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

type Cell = { x: number; y: number };
type Dir = { dx: number; dy: number };

function randomFruitType(): FruitType {
  return FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
}

function spawnFood(snake: Cell[]): Cell & { type: FruitType } {
  let pos: Cell;
  do {
    pos = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
  return { ...pos, type: randomFruitType() };
}

function drawGameOver(ctx: CanvasRenderingContext2D, score: number) {
  const W = COLS * CELL;
  const H = ROWS * CELL;
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff00ff";
  ctx.font = "bold 40px monospace";
  ctx.fillText("GAME OVER", W / 2, H / 2 - 20);
  ctx.fillStyle = "#aaa";
  ctx.font = "20px monospace";
  ctx.fillText(`SCORE: ${score}`, W / 2, H / 2 + 20);
  ctx.textAlign = "left";
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  snake: Cell[],
  food: Cell & { type: FruitType },
  score: number,
  fruitsImg: HTMLImageElement,
) {
  const W = COLS * CELL;
  const H = ROWS * CELL;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Wall border
  ctx.strokeStyle = "#ff00ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // Snake body
  for (let i = 1; i < snake.length; i++) {
    const s = snake[i];
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
  }

  // Snake head (brighter)
  if (snake.length > 0) {
    const head = snake[0];
    ctx.fillStyle = "#80ffcc";
    ctx.fillRect(head.x * CELL + 1, head.y * CELL + 1, CELL - 2, CELL - 2);
  }

  // Food sprite — guard in case image hasn't loaded yet
  if (fruitsImg.complete && fruitsImg.naturalHeight !== 0) {
    const sp = SPRITE_ATLAS[food.type];
    ctx.drawImage(
      fruitsImg,
      sp.x,
      sp.y,
      sp.w,
      sp.h,
      food.x * CELL,
      food.y * CELL,
      CELL,
      CELL,
    );
  }

  // HUD
  ctx.fillStyle = "#aaa";
  ctx.font = "12px monospace";
  ctx.fillText(`SCORE ${score}`, 8, 16);
}

export function initGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameController {
  const ctx = canvas.getContext("2d")!;

  let snake: Cell[] = [
    { x: 16, y: 16 },
    { x: 15, y: 16 },
    { x: 14, y: 16 },
  ];
  let dir: Dir = { dx: 1, dy: 0 };
  let nextDir: Dir = { dx: 1, dy: 0 };
  let food = spawnFood(snake);
  let score = 0;
  let fruitsEaten = 0;
  let interval = INITIAL_INTERVAL;
  let paused = false;
  let dead = false;
  let timerId: ReturnType<typeof setInterval> | null = null;

  const fruitsImg = new Image();
  fruitsImg.src = "/snake/fruits.png";

  function onKey(e: KeyboardEvent) {
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        e.code,
      )
    )
      e.preventDefault();
    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        nextDir = { dx: 0, dy: -1 };
        break;
      case "ArrowDown":
      case "KeyS":
        nextDir = { dx: 0, dy: 1 };
        break;
      case "ArrowLeft":
      case "KeyA":
        nextDir = { dx: -1, dy: 0 };
        break;
      case "ArrowRight":
      case "KeyD":
        nextDir = { dx: 1, dy: 0 };
        break;
    }
  }

  window.addEventListener("keydown", onKey);

  function step() {
    if (paused || dead) return;

    // Apply nextDir unless it's a direct reverse
    if (!(nextDir.dx === -dir.dx && nextDir.dy === -dir.dy)) {
      dir = nextDir;
    }

    const head = snake[0];
    const newHead = { x: head.x + dir.dx, y: head.y + dir.dy };

    // Wall collision
    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      dead = true;
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
      drawGameOver(ctx, score);
      callbacks.onGameOver(score);
      return;
    }

    // Self collision
    if (snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      dead = true;
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
      drawGameOver(ctx, score);
      callbacks.onGameOver(score);
      return;
    }

    const ateFood = newHead.x === food.x && newHead.y === food.y;

    snake = [newHead, ...snake];
    if (!ateFood) {
      snake = snake.slice(0, -1);
    } else {
      score += POINTS_PER_FRUIT;
      fruitsEaten++;
      callbacks.onScore(score);

      food = spawnFood(snake);

      if (fruitsEaten % SPEED_STEP === 0) {
        interval = Math.max(MIN_INTERVAL, Math.round(interval * SPEED_FACTOR));
        clearInterval(timerId!);
        timerId = setInterval(step, interval);
      }
    }

    drawFrame(ctx, snake, food, score, fruitsImg);
  }

  // Start immediately — image load is async; guard drawImage inside drawFrame
  drawFrame(ctx, snake, food, score, fruitsImg);
  timerId = setInterval(step, interval);

  fruitsImg.onload = () => {
    // Re-draw once image is ready so food sprite appears
    if (!dead && !paused) drawFrame(ctx, snake, food, score, fruitsImg);
  };

  function pause() {
    paused = true;
  }
  function resume() {
    paused = false;
  }
  function destroy() {
    if (timerId !== null) clearInterval(timerId);
    window.removeEventListener("keydown", onKey);
  }

  return { pause, resume, destroy };
}
