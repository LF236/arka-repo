"use client";

import { use, Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Game, GAMES, ScoreRow, seededScores } from "@/lib/data";
import {
  fetchCatalog,
  fetchRealGames,
  fetchTopScores,
} from "@/lib/supabase/leaderboard";

function GameDetailContent({ id }: { id: string }) {
  const [game, setGame] = useState<Game | null>(
    () => GAMES.find((g) => g.id === id) ?? null,
  );
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [scores, setScores] = useState<ScoreRow[]>(() =>
    seededScores(id.length * 17 + 3, 10),
  );
  const [isEmpty, setIsEmpty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const catalog = await fetchCatalog();
      if (cancelled) return;
      const found = catalog.find((g) => g.id === id) ?? null;
      setGame(found);
      setCatalogLoaded(true);

      if (!found) return;

      const realGames = await fetchRealGames();
      if (!realGames.includes(id) || cancelled) return;

      const data = await fetchTopScores(id, 10);
      if (cancelled) return;

      if (data.length) {
        setScores(data);
      } else {
        setScores([]);
        setIsEmpty(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (catalogLoaded && !game) notFound();
  if (!game) return null;

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={`cover-bg ${game.cover}`} />
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                {game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/juego/${game.id}/jugar`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {isEmpty ? (
            <div
              style={{ textAlign: "center", padding: "32px 0", opacity: 0.5 }}
            >
              <p className="pixel" style={{ fontSize: 10 }}>
                SIN PUNTUACIONES AÚN
              </p>
            </div>
          ) : (
            scores.map((r, i) => (
              <div
                key={r.name + i}
                className={`lb-row${i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : ""}`}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">
                  {r.name}
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--ink-faint)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {r.date}
                  </div>
                </div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function GameDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <GameDetailContent id={id} />;
}

export default function GameDetail({ params }: PageProps<"/juego/[id]">) {
  return (
    <Suspense>
      <GameDetailLoader params={params} />
    </Suspense>
  );
}
