import type { SkinId } from "@/lib/skins";

export interface Palette {
  background: string;
  ship: string;
  thrust: string;
  asteroid: string;
  bullet: string;
  particle: string;
  powerUp: string;
  hudText: string;
  lifeIcon: string;
  powerUpHud: string;
  overlayTitle: string;
  overlaySub: string;
  /** shadowBlur; 0 = sin glow */
  glow: number;
}

export const PALETTES: Partial<Record<SkinId, Palette>> = {
  clasico: {
    background: "#000000",
    ship: "#ffffff",
    thrust: "#ff8200",
    asteroid: "#ffffff",
    bullet: "#ffffff",
    particle: "#ffffff",
    powerUp: "#00ffff",
    hudText: "#ffffff",
    lifeIcon: "#ffffff",
    powerUpHud: "#00ffff",
    overlayTitle: "#ffffff",
    overlaySub: "#a6a6a6",
    glow: 0,
  },
  neon: {
    background: "#05050a",
    ship: "#00ff88",
    thrust: "#ff8a00",
    asteroid: "#ff006e",
    bullet: "#f5ff00",
    particle: "#ff006e",
    powerUp: "#00f5ff",
    hudText: "#e6e9ff",
    lifeIcon: "#00ff88",
    powerUpHud: "#00f5ff",
    overlayTitle: "#ff006e",
    overlaySub: "#00f5ff",
    glow: 12,
  },
  retro: {
    background: "#030a04",
    ship: "#aaffbb",
    thrust: "#ffb000",
    asteroid: "#2bd45a",
    bullet: "#ffb000",
    particle: "#2bd45a",
    powerUp: "#ffb000",
    hudText: "#33ff66",
    lifeIcon: "#aaffbb",
    powerUpHud: "#ffb000",
    overlayTitle: "#33ff66",
    overlaySub: "#1fa84a",
    glow: 0,
  },
};

export const AVAILABLE_SKINS = Object.keys(PALETTES) as SkinId[];
