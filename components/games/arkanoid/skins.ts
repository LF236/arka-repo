import type { SkinId } from "@/lib/skins";

export interface Palette {
  /** true = usa el spritesheet original (solo clasico) */
  useSprites: boolean;
  background: string;
  /** color por tipo de bloque (red, yellow, cyan, magenta, hotpink, green, gray) */
  blocks: Record<string, string>;
  blockEdge: string;
  paddle: string;
  ball: string;
  /** shadowBlur; 0 = sin glow */
  glow: number;
}

export const PALETTES: Partial<Record<SkinId, Palette>> = {
  clasico: {
    // Los colores de bloques/paleta/bola son aproximaciones; clasico dibuja el sprite.
    useSprites: true,
    background: "#000000",
    blocks: {
      red: "#e63232",
      yellow: "#e6d232",
      cyan: "#32c8e6",
      magenta: "#b432e6",
      hotpink: "#e632a0",
      green: "#32e650",
      gray: "#a0a0a0",
    },
    blockEdge: "#000000",
    paddle: "#c8c8c8",
    ball: "#ffffff",
    glow: 0,
  },
  neon: {
    useSprites: false,
    background: "#05050a",
    blocks: {
      red: "#ff3355",
      yellow: "#f5ff00",
      cyan: "#00f5ff",
      magenta: "#c026ff",
      hotpink: "#ff006e",
      green: "#00ff88",
      gray: "#b8c0ff",
    },
    blockEdge: "#05050a",
    paddle: "#00f5ff",
    ball: "#ffffff",
    glow: 12,
  },
  retro: {
    useSprites: false,
    background: "#030a04",
    blocks: {
      red: "#ffb000",
      yellow: "#ffb000",
      cyan: "#33ff66",
      magenta: "#1fa84a",
      hotpink: "#b36b00",
      green: "#33ff66",
      gray: "#1fa84a",
    },
    blockEdge: "#030a04",
    paddle: "#aaffbb",
    ball: "#aaffbb",
    glow: 0,
  },
};

export const AVAILABLE_SKINS = Object.keys(PALETTES) as SkinId[];
