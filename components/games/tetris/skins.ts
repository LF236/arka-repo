import type { SkinId } from "@/lib/skins";

export interface Palette {
  background: string;
  grid: string;
  /** índice 1..8 = I, O, T, S, Z, J, L, N (índice 0 sin uso) */
  pieces: string[];
  /** franja superior del bloque (bisel); transparente = sin bisel */
  bevel: string;
  ghostAlpha: number;
  /** shadowBlur; 0 = sin glow */
  glow: number;
}

export const PALETTES: Partial<Record<SkinId, Palette>> = {
  clasico: {
    background: "#000000",
    grid: "rgba(255,255,255,0.12)",
    pieces: [
      "",
      "#00e5ff",
      "#ffd600",
      "#b400ff",
      "#00e04b",
      "#ff1744",
      "#2979ff",
      "#ff9100",
      "#f5f5f5",
    ],
    bevel: "rgba(255,255,255,0.12)",
    ghostAlpha: 0.2,
    glow: 0,
  },
  neon: {
    background: "#05050a",
    grid: "rgba(0,245,255,0.14)",
    pieces: [
      "",
      "#00f5ff",
      "#f5ff00",
      "#ff006e",
      "#00ff88",
      "#ff3b1f",
      "#3d6bff",
      "#ffa800",
      "#b967ff",
    ],
    bevel: "rgba(0,0,0,0)",
    ghostAlpha: 0.25,
    glow: 8,
  },
  retro: {
    background: "#030a04",
    grid: "#0f2a14",
    pieces: [
      "",
      "#33ff66",
      "#ffb000",
      "#aaffbb",
      "#ffe08a",
      "#1fa84a",
      "#b36b00",
      "#66ffee",
      "#e8ffe8",
    ],
    bevel: "rgba(0,0,0,0)",
    ghostAlpha: 0.3,
    glow: 0,
  },
  pastel: {
    background: "#14121c",
    grid: "rgba(255,255,255,0.08)",
    pieces: [
      "",
      "#4dd0e1",
      "#ffd54f",
      "#ba68c8",
      "#81c784",
      "#e57373",
      "#90caf9",
      "#ffb74d",
      "#9e9e9e",
    ],
    bevel: "rgba(255,255,255,0.12)",
    ghostAlpha: 0.2,
    glow: 0,
  },
};

export const AVAILABLE_SKINS = Object.keys(PALETTES) as SkinId[];
