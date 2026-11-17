"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import GamePad from "@/components/GamePad";
import { initGame } from "./game";
import { insertScore } from "@/lib/supabase/leaderboard";
import { useSkin } from "@/components/SkinContext";
import { useUser } from "@/components/UserContext";
import { SKIN_LABELS } from "@/lib/skins";
import { AVAILABLE_SKINS } from "./skins";
import type { GameController } from "./game";

interface GameProps {
  gameId: string;
}

export default function SnakeGame({ gameId }: GameProps) {
  const [finalScore, setFinalScore] = useState(0);
  const scoreRef = useRef(0);
  const scoreEl = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const { user } = useUser();
  const defaultName = user ? user.name.toUpperCase().slice(0, 10) : "";
  const [nameEdit, setName] = useState<string | null>(null);
  const name = nameEdit ?? defaultName;
  const [saved, setSaved] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const { skin, setSkin } = useSkin();
  const skinRef = useRef(skin);
  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<GameController | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controller = initGame(
      canvas,
      {
        onScore: (s) => {
          scoreRef.current = s;
          if (scoreEl.current)
            scoreEl.current.textContent = s.toLocaleString("es-ES");
        },
        onGameOver: (final) => {
          scoreRef.current = final;
          if (scoreEl.current)
            scoreEl.current.textContent = final.toLocaleString("es-ES");
          setFinalScore(final);
          setOver(true);
        },
      },
      { skin: skinRef.current },
    );
    controllerRef.current = controller;

    return () => {
      controllerRef.current?.destroy();
    };
  }, [gameKey]);

  useEffect(() => {
    controllerRef.current?.setSkin(skin);
  }, [skin]);

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
    setFinalScore(scoreRef.current);
    setOver(true);
  };

  const saveScore = () => {
    if (!user) return;
    void insertScore("snake", name, finalScore, user.id);
    try {
      const all = JSON.parse(localStorage.getItem("av_scores_snake") || "[]");
      all.push({ score: finalScore, name, at: Date.now() });
      localStorage.setItem("av_scores_snake", JSON.stringify(all));
    } catch {}
    setSaved(true);
  };

  const restart = () => {
    controllerRef.current?.destroy();
    scoreRef.current = 0;
    if (scoreEl.current) scoreEl.current.textContent = "0";
    setPaused(false);
    setOver(false);
    setSaved(false);
    setName(null);
    setGameKey((k) => k + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name || "—"}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v" ref={scoreEl}>
              0
            </div>
          </div>
        </div>
        <div className="hud-actions max-lg:hidden">
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

      <div className="skin-selector" role="group" aria-label="Tema visual">
        <span className="skin-selector-label">TEMA</span>
        {AVAILABLE_SKINS.map((id) => (
          <button
            key={id}
            type="button"
            className={`skin-selector-btn${skin === id ? " active" : ""}`}
            aria-pressed={skin === id}
            onClick={(e) => {
              setSkin(id);
              e.currentTarget.blur();
            }}
          >
            {SKIN_LABELS[id]}
          </button>
        ))}
        <Link href="/biblioteca" className="btn ghost skin-back">
          REGRESAR
        </Link>
      </div>

      <div className="crt" style={{ maxWidth: 848, margin: "0 auto" }}>
        <div className="crt-screen" tabIndex={0} style={{ aspectRatio: "1" }}>
          <canvas ref={canvasRef} width={800} height={800} />
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
          <span>SNAKE · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <GamePad
        paused={paused}
        over={over}
        onTogglePause={togglePause}
        onEnd={handleEnd}
        exitHref={`/juego/${gameId}`}
      />

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString("es-ES")}</div>
            {!user ? (
              <div className="input-row">
                <Link
                  href="/auth?next=/juego/snake/jugar"
                  className="btn yellow"
                >
                  INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN
                </Link>
              </div>
            ) : !saved ? (
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
