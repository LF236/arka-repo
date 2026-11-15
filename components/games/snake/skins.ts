import type { SkinId } from "@/lib/skins";

export interface Palette {
  background: string;
  wall: string;
  snakeBody: string;
  snakeHead: string;
  /** color de la fruta cuando no se usa el sprite */
  fruit: string;
  /** brillo/tallo de la fruta dibujada con primitivas */
  fruitAccent: string;
  /** "sprite" = atlas original; resto = primitivas de canvas */
  fruitStyle: "sprite" | "circle" | "square";
  hudText: string;
  overlayShade: string;
  overlayTitle: string;
  overlaySub: string;
  /** shadowBlur; 0 = sin glow */
  glow: number;
}

export const PALETTES: Partial<Record<SkinId, Palette>> = {
  clasico: {
    background: "#000000",
    wall: "#ff00ff",
    snakeBody: "#00ff88",
    snakeHead: "#80ffcc",
    fruit: "#ff4444",
    fruitAccent: "#ffffff",
    fruitStyle: "sprite",
    hudText: "#aaaaaa",
    overlayShade: "rgba(0,0,0,0.72)",
    overlayTitle: "#ff00ff",
    overlaySub: "#aaaaaa",
    glow: 0,
  },
  neon: {
    background: "#05050a",
    wall: "#ff006e",
    snakeBody: "#00ff88",
    snakeHead: "#00f5ff",
    fruit: "#f5ff00",
    fruitAccent: "#ffffff",
    fruitStyle: "circle",
    hudText: "#e6e9ff",
    overlayShade: "rgba(5,5,10,0.78)",
    overlayTitle: "#ff006e",
    overlaySub: "#00f5ff",
    glow: 12,
  },
  retro: {
    background: "#030a04",
    wall: "#1fa84a",
    snakeBody: "#2bd45a",
    snakeHead: "#aaffbb",
    fruit: "#ffb000",
    fruitAccent: "#ffb000",
    fruitStyle: "square",
    hudText: "#33ff66",
    overlayShade: "rgba(3,10,4,0.82)",
    overlayTitle: "#33ff66",
    overlaySub: "#1fa84a",
    glow: 0,
  },
};

export const AVAILABLE_SKINS = Object.keys(PALETTES) as SkinId[];
