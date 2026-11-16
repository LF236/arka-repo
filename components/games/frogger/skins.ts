import type { SkinId } from "@/lib/skins";

export interface Palette {
  goalBank: string;
  mouth: string;
  water: string;
  safe: string;
  road: string;
  roadLine: string;
  start: string;
  log: string;
  logDark: string;
  turtle: string;
  turtleShell: string;
  cars: [string, string, string];
  carWindow: string;
  truck: string;
  truckCab: string;
  text: string;
  timeBar: string;
  timeBarLow: string;
  frog: string;
  frogDark: string;
  frogEye: string;
  frogPupil: string;
  glow: number;
}

export const PALETTES: Partial<Record<SkinId, Palette>> = {
  clasico: {
    goalBank: "#003a2a",
    mouth: "#001018",
    water: "#00243a",
    safe: "#0f3a1a",
    road: "#1a1a28",
    roadLine: "#3a3a52",
    start: "#0f3a1a",
    log: "#8a5a2a",
    logDark: "#5e3a18",
    turtle: "#00cc66",
    turtleShell: "#007a3d",
    cars: ["#ff2d95", "#00e5ff", "#ffd700"],
    carWindow: "rgba(255,255,255,0.35)",
    truck: "#ff7a00",
    truckCab: "rgba(0,0,0,0.35)",
    text: "#e8e8ff",
    timeBar: "#00ff88",
    timeBarLow: "#ff3355",
    frog: "#7dff3a",
    frogDark: "#2a9a10",
    frogEye: "#ffffff",
    frogPupil: "#000000",
    glow: 0,
  },
  neon: {
    goalBank: "#001a14",
    mouth: "#000000",
    water: "#00101f",
    safe: "#001a0d",
    road: "#0a0a12",
    roadLine: "#2a2a4a",
    start: "#001a0d",
    log: "#ff006e",
    logDark: "#8a0038",
    turtle: "#00875a",
    turtleShell: "#00ff88",
    cars: ["#00f5ff", "#ff006e", "#00ff88"],
    carWindow: "rgba(0,0,0,0.45)",
    truck: "#ff8a00",
    truckCab: "rgba(0,0,0,0.45)",
    text: "#e8f8ff",
    timeBar: "#00ff88",
    timeBarLow: "#ff006e",
    frog: "#f5ff00",
    frogDark: "#b8c000",
    frogEye: "#ffffff",
    frogPupil: "#000000",
    glow: 12,
  },
  // Fósforo verde: #000000 #072607 #0b3d0b #1e8a1e #5cff5c #c8ffc8
  retro: {
    goalBank: "#0b3d0b",
    mouth: "#000000",
    water: "#072607",
    safe: "#0b3d0b",
    road: "#000000",
    roadLine: "#1e8a1e",
    start: "#0b3d0b",
    log: "#1e8a1e",
    logDark: "#0b3d0b",
    turtle: "#1e8a1e",
    turtleShell: "#0b3d0b",
    cars: ["#5cff5c", "#c8ffc8", "#1e8a1e"],
    carWindow: "rgba(0,0,0,0.5)",
    truck: "#c8ffc8",
    truckCab: "rgba(0,0,0,0.5)",
    text: "#c8ffc8",
    timeBar: "#5cff5c",
    timeBarLow: "#c8ffc8",
    frog: "#c8ffc8",
    frogDark: "#5cff5c",
    frogEye: "#000000",
    frogPupil: "#c8ffc8",
    glow: 0,
  },
};

export const AVAILABLE_SKINS = Object.keys(PALETTES) as SkinId[];
