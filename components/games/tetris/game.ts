import { resolveSkin, DEFAULT_SKIN } from "@/lib/skins";
import type { SkinId } from "@/lib/skins";
import { PALETTES, AVAILABLE_SKINS } from "./skins";
import type { Palette } from "./skins";

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLines: (lines: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setSkin: (id: SkinId) => void;
}

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const PIECES = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [2, 2],
    [2, 2],
  ],
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ],
];

const LINE_SCORES = [0, 100, 300, 500, 800];

type Board = number[][];
interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export function initGame(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: { skin?: SkinId },
): GameController {
  const ctx = boardCanvas.getContext("2d")!;
  const nextCtx = nextCanvas.getContext("2d")!;

  let palette: Palette = PALETTES[
    resolveSkin(options?.skin ?? DEFAULT_SKIN, AVAILABLE_SKINS)
  ] as Palette;

  let spriteCache: HTMLCanvasElement[] | null = null;
  let spritePad = 0;

  const board: Board = createBoard();
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let paused: boolean;
  let gameOver: boolean;
  let lastTime: number;
  let dropAccum: number;
  let dropInterval: number;
  let animId: number;

  function createBoard(): Board {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = (PIECES[type] as number[][]).map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length,
      cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate(): void {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge(): void {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      callbacks.onScore(score);
      callbacks.onLines(lines);
      callbacks.onLevel(level);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop(): void {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    callbacks.onScore(score);
    lockPiece();
  }

  function softDrop(): void {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      callbacks.onScore(score);
    } else {
      lockPiece();
    }
  }

  function lockPiece(): void {
    merge();
    clearLines();
    spawn();
  }

  function spawn(): void {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
      return;
    }
    drawNext();
  }

  function buildSpriteCache(): void {
    spriteCache = null;
    if (!palette.glow) return;
    const pad = 2 * palette.glow;
    const side = BLOCK + 2 * pad;
    const cache: HTMLCanvasElement[] = [];
    for (let i = 1; i < palette.pieces.length; i++) {
      const sprite = document.createElement("canvas");
      sprite.width = side;
      sprite.height = side;
      const sctx = sprite.getContext("2d")!;
      sctx.translate(pad, pad);
      drawBlockDirect(sctx, 0, 0, i, BLOCK);
      cache[i] = sprite;
    }
    spriteCache = cache;
    spritePad = pad;
  }

  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ): void {
    if (!colorIndex) return;
    if (spriteCache && alpha === undefined && size === BLOCK) {
      context.drawImage(
        spriteCache[colorIndex],
        x * size - spritePad,
        y * size - spritePad,
      );
      return;
    }
    drawBlockDirect(context, x, y, colorIndex, size, alpha);
  }

  function drawBlockDirect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ): void {
    if (!colorIndex) return;
    const color = palette.pieces[colorIndex];
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    if (palette.glow && alpha === undefined) {
      context.shadowColor = color;
      context.shadowBlur = palette.glow;
    }
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.shadowBlur = 0;
    context.fillStyle = palette.bevel;
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid(): void {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function draw(): void {
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawGrid();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            palette.ghostAlpha,
          );
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK,
        );
  }

  function drawNext(): void {
    const NB = 30;
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextCtx.fillStyle = palette.background;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  }

  function endGame(): void {
    gameOver = true;
    cancelAnimationFrame(animId);
    callbacks.onGameOver(score);
  }

  function loop(ts: number): void {
    if (paused || gameOver) return;
    const dt = ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    if (gameOver) return;
    draw();
    animId = requestAnimationFrame(loop);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (
      ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(
        e.code,
      )
    )
      e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  }

  // init
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  buildSpriteCache();
  next = randomPiece();
  spawn();
  callbacks.onScore(score);
  callbacks.onLines(lines);
  callbacks.onLevel(level);
  animId = requestAnimationFrame(loop);

  document.addEventListener("keydown", onKeyDown);

  return {
    pause() {
      if (gameOver || paused) return;
      paused = true;
      cancelAnimationFrame(animId);
    },
    resume() {
      if (gameOver || !paused) return;
      paused = false;
      lastTime = performance.now();
      animId = requestAnimationFrame(loop);
    },
    destroy() {
      cancelAnimationFrame(animId);
      document.removeEventListener("keydown", onKeyDown);
      gameOver = true;
      spriteCache = null;
    },
    setSkin(id: SkinId) {
      palette = PALETTES[resolveSkin(id, AVAILABLE_SKINS)] as Palette;
      buildSpriteCache();
      drawNext();
      if (paused || gameOver) draw();
    },
  };
}
