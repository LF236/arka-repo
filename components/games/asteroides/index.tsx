"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { initGame } from "./game";
import { insertScore } from "@/lib/supabase/leaderboard";
import type { GameController } from "./game";

interface GameProps {
  gameId: string;
}

export default function AsteroidesGame({ gameId }: GameProps) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(
    () => localStorage.getItem("av_player_name") ?? "",
  );
  const [saved, setSaved] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<GameController | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controller = initGame(canvas, {
      onScore: (s) => setScore(s),
      onLives: (l) => setLives(l),
      onLevel: (l) => setLevel(l),
      onGameOver: (finalScore) => {
        setScore(finalScore);
        setOver(true);
      },
    });
    controllerRef.current = controller;

    return () => {
      controllerRef.current?.destroy();
    };
  }, [gameKey]);

  const togglePause = () => {
    setPaused((p) => {
      if (p) {
        controllerRef.current?.resume();
      } else {
        controllerRef.current?.pause();
      }
      return !p;
    });
  };

  const handleEnd = () => {
    controllerRef.current?.pause();
    setOver(true);
  };

  const saveScore = () => {
    void insertScore("asteroides", name, score);
    try {
      const all = JSON.parse(
        localStorage.getItem("av_scores_asteroides") || "[]",
      );
      all.push({ score, name, at: Date.now() });
      localStorage.setItem("av_scores_asteroides", JSON.stringify(all));
      localStorage.setItem("av_player_name", name);
    } catch {}
    setSaved(true);
  };

  const restart = () => {
    controllerRef.current?.destroy();
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setName(localStorage.getItem("av_player_name") ?? "");
    setGameKey((k) => k + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">
              {"♥ ".repeat(Math.max(0, lives)).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={handleEnd}>
            FIN
          </button>
          <Link href={`/juego/${gameId}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen" tabIndex={0}>
          <canvas ref={canvasRef} width={800} height={600} />
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>ASTEROIDES · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={saveScore}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
