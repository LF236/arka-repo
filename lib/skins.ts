export type SkinId = "clasico" | "neon" | "retro" | "pastel";
export const REQUIRED_SKINS: SkinId[] = ["clasico", "neon", "retro"];
export const DEFAULT_SKIN: SkinId = "clasico";
export const SKIN_STORAGE_KEY = "av_skin";
export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEON",
  retro: "RETRO",
  pastel: "PASTEL",
};

const ALL_SKINS: SkinId[] = ["clasico", "neon", "retro", "pastel"];

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && (ALL_SKINS as string[]).includes(value);
}

export function resolveSkin(id: SkinId, available: SkinId[]): SkinId {
  return available.includes(id) ? id : DEFAULT_SKIN;
}
