import {
  drawFrame,
  drawSprite,
  loadSpritesheet,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
} from "./spritesheet";

// ─── Levels ──────────────────────────────────────────────────────────────────

interface LevelBlock {
  col: number;
  row: number;
  color: string;
}

interface Level {
  speed: number;
  blocks: LevelBlock[];
}

const LEVELS: Level[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({
          col,
          row,
          color: isCross && !isFrame ? "hotpink" : "cyan",
        });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

// ─── Public API ───────────────────────────────────────────────────────────────

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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (800 - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

// ─── initGame ─────────────────────────────────────────────────────────────────

export function initGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameController {
  const ctx = canvas.getContext("2d")!;

  // Audio created fresh per game instance — prevents double sounds from
  // React StrictMode double-invoking effects or multiple initGame calls.
  const bounceSound = new Audio("/games/arkanoid/sounds/ball-bounce.mp3");
  const breakSound = new Audio("/games/arkanoid/sounds/break-sound.mp3");

  const playBounce = () =>
    (bounceSound.cloneNode() as HTMLAudioElement).play().catch(() => {});
  const playBreak = () =>
    (breakSound.cloneNode() as HTMLAudioElement).play().catch(() => {});

  // ── State ──────────────────────────────────────────────────────────────────
  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };

  interface Block {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    alive: boolean;
  }
  interface Explosion {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    elapsed: number;
  }

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let gameState: "playing" | "gameover" | "win" = "playing";
  let currentLevel = 1;
  let paused = false;

  let destroyed = false;
  let raf = 0;
  let lastTime: number | null = null;
  let gameOverFired = false;

  const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function initPaddle() {
    paddle.x = (canvas.width - paddle.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  function update(dt: number) {
    if (gameState !== "playing") return;

    // Paddle keys
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(
        canvas.width - paddle.w,
        paddle.x + PADDLE_SPEED * dt,
      );

    // Ball movement
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall bounces
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playBounce();
    }
    if (ball.x + ball.w >= canvas.width) {
      ball.x = canvas.width - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playBounce();
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playBounce();
    }

    // Paddle bounce — only reflect the ball, never touch lives
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playBounce();
    }

    // Block collisions
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        callbacks.onScore(score);
        ball.vy = -ball.vy;
        playBreak();

        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < 5) {
            loadLevel(currentLevel + 1);
            callbacks.onLevel(currentLevel);
          } else {
            gameState = "win";
            if (!gameOverFired) {
              gameOverFired = true;
              callbacks.onGameOver(score);
            }
          }
        }
        break; // one block per frame
      }
    }

    // Explosions
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Ball lost — only here do lives change
    if (ball.y > canvas.height) {
      lives--;
      callbacks.onLives(lives);
      if (lives <= 0) {
        lives = 0;
        gameState = "gameover";
        if (!gameOverFired) {
          gameOverFired = true;
          callbacks.onGameOver(score);
        }
      } else {
        initBall();
      }
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const block of blocks) {
      if (block.alive)
        drawSprite(
          ctx,
          "block_" + block.color,
          block.x,
          block.y,
          block.w,
          block.h,
        );
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(
        ctx,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    drawSprite(ctx, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(ctx, "ball", ball.x, ball.y, ball.w, ball.h);
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  function loop(timestamp: number) {
    if (destroyed) return;
    if (lastTime === null) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = timestamp;

    if (!paused) update(dt);
    draw();

    raf = requestAnimationFrame(loop);
  }

  // ── Event listeners — stored as named refs for clean removal ──────────────

  const onMouseMove = (e: MouseEvent) => {
    if (gameState !== "playing" || paused) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(
      0,
      Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2),
    );
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        e.code,
      )
    )
      e.preventDefault();
    if (e.key in keys) keys[e.key] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key in keys) keys[e.key] = false;
  };

  canvas.addEventListener("mousemove", onMouseMove);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // ── Boot ───────────────────────────────────────────────────────────────────

  loadSpritesheet(() => {
    if (destroyed) return;
    initPaddle();
    loadLevel(1);
    raf = requestAnimationFrame(loop);
  });

  // ── Controller ─────────────────────────────────────────────────────────────

  return {
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      lastTime = null; // reset dt so a long pause doesn't cause a physics jump
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    },
  };
}
