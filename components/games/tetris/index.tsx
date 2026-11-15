"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import GamePad from "@/components/GamePad";
import { initGame } from "./game";
import { insertScore } from "@/lib/supabase/leaderboard";
import { useSkin } from "@/components/SkinContext";
import { SKIN_LABELS } from "@/lib/skins";
import { AVAILABLE_SKINS } from "./skins";
import type { GameController } from "./game";

interface GameProps {
  gameId: string;
}

export default function TetrisGame({ gameId }: GameProps) {
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(
    () => localStorage.getItem("av_player_name") ?? "",
  );
  const [saved, setSaved] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const { skin, setSkin } = useSkin();
  const skinRef = useRef(skin);
  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);

  const boardCanvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<GameController | null>(null);

  useEffect(() => {
    const boardCanvas = boardCanvasRef.current;
    const nextCanvas = nextCanvasRef.current;
    if (!boardCanvas || !nextCanvas) return;

    const controller = initGame(
      boardCanvas,
      nextCanvas,
      {
        onScore: (s) => setScore(s),
        onLines: (l) => setLines(l),
        onLevel: (l) => setLevel(l),
        onGameOver: (finalScore) => {
          setScore(finalScore);
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
    setOver(true);
  };

  const saveScore = () => {
    void insertScore("tetris", name, score);
    try {
      const all = JSON.parse(localStorage.getItem("av_scores_tetris") || "[]");
      all.push({ score, name, at: Date.now() });
      localStorage.setItem("av_scores_tetris", JSON.stringify(all));
      localStorage.setItem("av_player_name", name);
    } catch {}
    setSaved(true);
  };

  const restart = () => {
    controllerRef.current?.destroy();
    setScore(0);
    setLines(0);
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
          <div className="hud-stat">
            <div className="l">Líneas</div>
            <div className="v">{lines}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
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

      <div className="crt">
        <div className="crt-screen" style={{ position: "relative" }}>
          <div
            className="tetris-stage"
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              justifyContent: "center",
              height: "100%",
              paddingTop: 24,
            }}
          >
            <canvas
              ref={boardCanvasRef}
              width={300}
              height={600}
              tabIndex={0}
              autoFocus
            />
            <canvas ref={nextCanvasRef} width={120} height={120} />
          </div>
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
          <span>TETRIS · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      <GamePad
        a={{ label: "CAÍDA", key: " ", code: "Space" }}
        b={{ label: "GIRAR", key: "x", code: "KeyX" }}
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
