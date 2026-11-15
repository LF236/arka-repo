"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useSkin } from "@/components/SkinContext";

export interface PadButton {
  label: string;
  key: string;
  code: string;
}

export interface GamePadProps {
  a?: PadButton;
  b?: PadButton;
  paused: boolean;
  over?: boolean;
  disableDown?: boolean;
  disableUp?: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
  exitHref: string;
}

const REPEAT_DELAY = 170;
const REPEAT_INTERVAL = 50;
// Los juegos leen teclas por polling por frame: un toque más corto se perdería.
const MIN_HOLD = 60;

const UP: PadButton = { label: "↑", key: "ArrowUp", code: "ArrowUp" };
const DOWN: PadButton = { label: "↓", key: "ArrowDown", code: "ArrowDown" };
const LEFT: PadButton = { label: "←", key: "ArrowLeft", code: "ArrowLeft" };
const RIGHT: PadButton = { label: "→", key: "ArrowRight", code: "ArrowRight" };

interface Held {
  btn: PadButton;
  pointerId: number;
  delay?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
  at: number;
}

function emit(type: "keydown" | "keyup", btn: PadButton, repeat = false) {
  document.dispatchEvent(
    new KeyboardEvent(type, {
      key: btn.key,
      code: btn.code,
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function Arrow({ d }: { d: string }) {
  return (
    <svg className="vp-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

export default function GamePad({
  a,
  b,
  paused,
  over = false,
  disableDown = false,
  disableUp = false,
  onTogglePause,
  onEnd,
  exitHref,
}: GamePadProps) {
  const { skin } = useSkin();
  const heldRef = useRef(new Map<string, Held>());

  const release = useCallback((code: string, force = false) => {
    const h = heldRef.current.get(code);
    if (!h) return;
    clearTimeout(h.delay);
    clearInterval(h.interval);
    heldRef.current.delete(code);
    const wait = force ? 0 : MIN_HOLD - (Date.now() - h.at);
    if (wait <= 0) {
      emit("keyup", h.btn);
    } else {
      setTimeout(() => {
        if (!heldRef.current.has(code)) emit("keyup", h.btn);
      }, wait);
    }
  }, []);

  const releaseAll = useCallback(() => {
    for (const code of [...heldRef.current.keys()]) release(code, true);
  }, [release]);

  const press = useCallback(
    (btn: PadButton, pointerId: number) => {
      if (heldRef.current.has(btn.code)) release(btn.code, true);
      const h: Held = { btn, pointerId, at: Date.now() };
      heldRef.current.set(btn.code, h);
      emit("keydown", btn);
      h.delay = setTimeout(() => {
        h.interval = setInterval(
          () => emit("keydown", btn, true),
          REPEAT_INTERVAL,
        );
      }, REPEAT_DELAY);
    },
    [release],
  );

  useEffect(() => {
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  useEffect(() => {
    if (paused || over) releaseAll();
  }, [paused, over, releaseAll]);

  const bind = (btn: PadButton) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      press(btn, e.pointerId);
    },
    onPointerUp: () => release(btn.code),
    onPointerCancel: () => release(btn.code),
    onPointerLeave: () => release(btn.code),
    onLostPointerCapture: () => release(btn.code),
  });

  const prevent = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className="gamepad lg:hidden"
      data-skin={skin}
      onContextMenu={prevent}
    >
      <div className="vp-main">
        <div className="vp-dpad" role="group" aria-label="D-pad">
          <button
            type="button"
            className="vp-dp vp-up"
            aria-label="Arriba"
            disabled={disableUp}
            {...bind(UP)}
          >
            <Arrow d="M12 4 L20 16 L4 16 Z" />
          </button>
          <button
            type="button"
            className="vp-dp vp-left"
            aria-label="Izquierda"
            {...bind(LEFT)}
          >
            <Arrow d="M16 4 L16 20 L4 12 Z" />
          </button>
          <button
            type="button"
            className="vp-dp vp-right"
            aria-label="Derecha"
            {...bind(RIGHT)}
          >
            <Arrow d="M8 4 L20 12 L8 20 Z" />
          </button>
          <button
            type="button"
            className="vp-dp vp-down"
            aria-label="Abajo"
            disabled={disableDown}
            {...bind(DOWN)}
          >
            <Arrow d="M4 8 L20 8 L12 20 Z" />
          </button>
          <div className="vp-hub" aria-hidden="true">
            <span className="vp-hub-gem" />
          </div>
        </div>
        <div className="vp-actions">
          <button
            type="button"
            className="vp-action b"
            disabled={!b}
            aria-label={b?.label ?? "B"}
            {...(b ? bind(b) : {})}
          >
            <span className="vp-ring" />
            <span className="vp-letter">B</span>
            <small>{b?.label ?? ""}</small>
          </button>
          <button
            type="button"
            className="vp-action a"
            disabled={!a}
            aria-label={a?.label ?? "A"}
            {...(a ? bind(a) : {})}
          >
            <span className="vp-ring" />
            <span className="vp-letter">A</span>
            <small>{a?.label ?? ""}</small>
          </button>
        </div>
      </div>
      <div className="vp-foot">
        <button type="button" className="vp-pill pause" onClick={onTogglePause}>
          {paused ? "REANUDAR" : "PAUSA"}
        </button>
        <button type="button" className="vp-pill end" onClick={onEnd}>
          FIN
        </button>
        <Link href={exitHref} className="vp-pill exit">
          SALIR
        </Link>
      </div>
    </div>
  );
}
