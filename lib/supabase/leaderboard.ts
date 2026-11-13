import { ScoreRow } from "@/lib/data";
import { createClient } from "./client";

export type ScoreRowWithGame = ScoreRow & { game?: string };

export async function fetchRealGames(): Promise<string[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("games")
      .select("slug")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return (data ?? []).map((r: { slug: string }) => r.slug);
  } catch {
    return [];
  }
}

export async function fetchTopScores(
  gameSlug?: string,
  limit = 12,
): Promise<ScoreRowWithGame[]> {
  try {
    const supabase = createClient();
    let data: Record<string, unknown>[];

    if (gameSlug) {
      const res = await supabase
        .from("scores")
        .select("player_name, score, created_at")
        .eq("game_slug", gameSlug)
        .order("score", { ascending: false })
        .limit(limit);
      if (res.error) throw res.error;
      data = res.data ?? [];
    } else {
      const res = await supabase
        .from("scores")
        .select("player_name, score, created_at, games(name)")
        .order("score", { ascending: false })
        .limit(limit);
      if (res.error) throw res.error;
      data = res.data ?? [];
    }

    return data.map((r, i) => {
      const createdAt = r.created_at as string | null;
      const date = createdAt
        ? new Date(createdAt).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "";
      const row: ScoreRowWithGame = {
        rank: i + 1,
        name: r.player_name as string,
        score: r.score as number,
        date,
      };
      if (!gameSlug) {
        const gamesJoin = r.games as { name: string } | null;
        row.game = gamesJoin?.name ?? "";
      }
      return row;
    });
  } catch {
    return [];
  }
}

export async function insertScore(
  gameSlug: string,
  playerName: string,
  score: number,
): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("scores")
      .insert({
        game_slug: gameSlug,
        player_name: playerName,
        score,
        user_id: null,
      });
    if (error) throw error;
  } catch (err) {
    console.error("[leaderboard] insertScore failed:", err);
  }
}
