"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { seededScores } from "@/lib/data";
import {
  fetchRealGames,
  fetchTopScores,
  ScoreRowWithGame,
} from "@/lib/supabase/leaderboard";

const GLOBAL = "global";

export default function Salon() {
  const [realGames, setRealGames] = useState<string[]>([]);
  const [tab, setTab] = useState<string>(GLOBAL);
  const [rows, setRows] = useState<ScoreRowWithGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRealGames().then((games) => {
      setRealGames(games.length ? games : ["asteroides"]);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      if (tab === GLOBAL) {
        const data = await fetchTopScores(undefined, 12);
        if (!cancelled) {
          setRows(data.length ? data : seededScores(0, 12));
          setLoading(false);
        }
      } else {
        const data = await fetchTopScores(tab, 12);
        if (!cancelled) {
          setRows(data);
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const isGlobal = tab === GLOBAL;
  const isEmpty = !loading && rows.length === 0;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        <button
          className={`chip${tab === GLOBAL ? " active" : ""}`}
          onClick={() => setTab(GLOBAL)}
        >
          GLOBAL
        </button>
        {realGames.map((slug) => (
          <button
            key={slug}
            className={`chip${tab === slug ? " active" : ""}`}
            onClick={() => setTab(slug)}
          >
            {slug.toUpperCase()}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <div style={{ textAlign: "center", padding: "64px 0", opacity: 0.5 }}>
          <p className="pixel" style={{ fontSize: 12 }}>
            SIN PUNTUACIONES AÚN
          </p>
        </div>
      ) : (
        <>
          <div className="podium">
            <div className="podium-slot silver">
              <div className="rank-num">02</div>
              <div className="name">{rows[1]?.name ?? "---"}</div>
              <div className="score">
                {(rows[1]?.score ?? 0).toLocaleString("es-ES")}
              </div>
              <div className="date">{rows[1]?.date ?? ""}</div>
            </div>
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: "var(--gold)",
                  letterSpacing: "0.18em",
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{rows[0]?.name ?? "---"}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {(rows[0]?.score ?? 0).toLocaleString("es-ES")}
              </div>
              <div className="date">{rows[0]?.date ?? ""}</div>
            </div>
            <div className="podium-slot bronze">
              <div className="rank-num">03</div>
              <div className="name">{rows[2]?.name ?? "---"}</div>
              <div className="score">
                {(rows[2]?.score ?? 0).toLocaleString("es-ES")}
              </div>
              <div className="date">{rows[2]?.date ?? ""}</div>
            </div>
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              {isGlobal && <div>JUEGO</div>}
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.name + i}
                className={`tr${i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : ""}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                {isGlobal && <div className="pl">{r.game ?? ""}</div>}
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
