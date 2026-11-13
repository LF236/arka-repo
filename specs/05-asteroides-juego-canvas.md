# SPEC 05 — Asteroides: Integración del Juego Canvas en Next.js

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-13
> **Objective:** Integrar el juego Asteroides (canvas vanilla JS 800×600) en la plataforma Next.js, con un componente React que carga el juego vía dynamic import, recibe notificaciones de estado (score, lives, level, gameover) por callbacks, controla la pausa por ref, y muestra su propio HUD externo al canvas coexistiendo con el HUD interno del juego.

---

## Scope

**In:**

- `lib/data.ts` — nueva entrada con `id: 'asteroides'` en el array `GAMES`
- `components/games/asteroides/game.ts` — `game.js` de referencia refactorizado como módulo TypeScript que acepta canvas, callbacks y ref de pausa
- `components/games/asteroides/index.tsx` — componente React `'use client'` que monta el canvas, gestiona el HUD externo y el modal de game over
- `app/juego/[id]/jugar/page.tsx` — añadir mapa estático de dynamic imports por ID; el mock existente queda como fallback

**Out of scope:**

- Persistencia de scores en Supabase (sigue en localStorage como los demás juegos)
- Controles táctiles / gamepad
- Leaderboard real de Asteroides en base de datos
- Otros juegos con canvas real (siguen usando el mock)
- Tests automatizados
- Sonido / música de fondo

---

## Data model

### Nueva entrada en `GAMES` (`lib/data.ts`)

```ts
{
  id: 'asteroides',
  title: 'ASTEROIDES',
  short: 'Pulveriza rocas espaciales en gravedad cero.',
  long: 'Tu nave triangular navega el vacío absoluto. Rota, dispara y esquiva para fragmentar asteroides en pedazos cada vez más pequeños. Recoge el power-up triple disparo y sobrevive hasta el último fragmento.',
  cat: 'SHOOTER',
  cover: 'cover-rocas',   // reusar clase CSS existente
  color: 'yellow',
  best: 41200,
  plays: '15.6K',
}
```

### Interfaz del módulo de juego

```ts
// components/games/asteroides/game.ts

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameController {
  pause: () => void;
  resume: () => void;
  destroy: () => void; // cancela rAF y quita listeners
}

export function initGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameController;
```

### GameProps compartido (componentes de canvas)

```ts
// No requiere un archivo separado; el index.tsx del juego exporta el componente
// La ruta lo importa vía dynamic y espera props { gameId: string }
interface GameProps {
  gameId: string;
}
```

---

## Implementation plan

1. **Añadir `asteroides` a `lib/data.ts`** — Insertar la nueva entrada (ver Data model) en el array `GAMES`. El ID debe ser exactamente `'asteroides'`, distinto de `'rocas'`. Verificación: `/juego/asteroides` carga la ficha con título "ASTEROIDES"; `/juego/rocas` no cambia.

2. **Crear `components/games/asteroides/game.ts`** — Adaptar `references/started-games/02-asteroids/game.js` como módulo TypeScript. Cambios mínimos respecto al original:
   - Eliminar `document.getElementById('canvas')` — el canvas se recibe por parámetro en `initGame`.
   - Eliminar referencias directas a `window.addEventListener` para input; moverlas dentro de `initGame` y registrar para cleanup en `destroy()`.
   - Añadir el parámetro `callbacks: GameCallbacks` a `initGame`; invocar cada callback en el momento correcto:
     - `callbacks.onScore(score)` — cada vez que `score` cambia (tras destruir un asteroide).
     - `callbacks.onLives(lives)` — cada vez que `lives` cambia (tras `killShip`).
     - `callbacks.onLevel(level)` — cada vez que `level` cambia (en `nextLevel`).
     - `callbacks.onGameOver(score)` — cuando `state` pasa a `'gameover'`.
   - Pausa: añadir variable interna `let paused = false` con funciones `pause()` y `resume()` que el game loop chequea cada frame:
     ```ts
     function loop(ts: number) {
       if (paused) {
         rafHandle = requestAnimationFrame(loop);
         return;
       }
       // update + draw normal
       rafHandle = requestAnimationFrame(loop);
     }
     ```
   - `destroy()` llama `cancelAnimationFrame(rafHandle)` y elimina los `keydown`/`keyup` listeners.
   - Mantener el HUD interno del canvas (`drawHUD`) intacto — se sigue dibujando.
   - `initGame` retorna `{ pause, resume, destroy }`.
   - Verificación: TypeScript compila sin errores; el juego funciona igual que el original en un archivo `test.html` local.

3. **Crear `components/games/asteroides/index.tsx`** — Componente `'use client'` que actúa de puente React↔canvas:
   - Props: `{ gameId: string }` (aunque no lo usa internamente, cumple la interfaz de la ruta).
   - Estado React: `score`, `lives` (init 3), `level` (init 1), `paused`, `over`, `name` (del UserContext o `'INVITADO'`), `saved`.
   - `canvasRef`: `useRef<HTMLCanvasElement>(null)`.
   - `controllerRef`: `useRef<GameController | null>(null)`.
   - `useEffect` (monta/desmonta): llama `initGame(canvas, callbacks)`, guarda el controller en `controllerRef.current`, retorna `() => controllerRef.current?.destroy()`.
   - Botón PAUSA: alterna `paused`, llama `controller.pause()` o `controller.resume()`.
   - Botón FIN: llama `controller.pause()`, `setOver(true)`.
   - Modal de game over: igual al modal existente en `app/juego/[id]/jugar/page.tsx` — input de nombre + "GUARDAR PUNTUACIÓN" (localStorage) + "JUGAR DE NUEVO".
   - "JUGAR DE NUEVO": llama `controller.destroy()`, reinicia estado React, re-monta montando el juego de nuevo (incrementar una key del canvas o llamar `initGame` de nuevo).
   - El HUD externo (`.player-hud`) muestra: nombre, score formateado, vidas como `♥` repetidas, nivel, botones PAUSA/FIN/SALIR — mismo estilo que el actual `av-player`.
   - El canvas `<canvas ref={canvasRef} width={800} height={600} />` va dentro del `.crt > .crt-screen` existente.
   - El canvas recibe `tabIndex={0}` en su wrapper para que el foco de teclado funcione.
   - Verificación: el canvas aparece y el juego responde a flechas y espacio; el HUD externo se actualiza en tiempo real.

4. **Modificar `app/juego/[id]/jugar/page.tsx`** — Añadir un mapa estático de dynamic imports en la parte superior del archivo (fuera del componente, para que Turbopack pueda analizarlo):

   ```ts
   const CANVAS_GAMES: Record<
     string,
     React.ComponentType<{ gameId: string }>
   > = {
     asteroides: dynamic(() => import("@/components/games/asteroides"), {
       ssr: false,
     }),
   };
   ```

   En `GamePlayerContent`, al inicio: `const CanvasGame = CANVAS_GAMES[id] ?? null;`. Si `CanvasGame` existe, renderizarlo en lugar del mock. Si es `null`, renderizar el mock tal cual está hoy. Los juegos sin componente canvas (`rocas`, `invasores`, etc.) siguen usando el mock. Verificación: `/juego/asteroides/jugar` carga el canvas; `/juego/rocas/jugar` mantiene el mock sin cambios.

5. **Verificar build** — `npm run build` y `npm run lint` pasan sin errores. Verificación: salida limpia de ambos comandos.

---

## Acceptance criteria

- [X] `/juego/asteroides` carga la ficha con el título "ASTEROIDES" y el botón "JUGAR AHORA"
- [X] `/juego/asteroides` y `/juego/rocas` muestran fichas distintas e independientes
- [X] `/juego/asteroides/jugar` carga el canvas 800×600 con el juego funcionando (nave, asteroides, balas)
- [X] El HUD externo de React (`.player-hud`) muestra nombre, score, vidas (♥), nivel — se actualizan en tiempo real
- [X] El canvas sigue mostrando su propio HUD interno (SCORE, NIVEL, iconos de vida dibujados en canvas)
- [X] El botón PAUSA congela el juego (el canvas deja de animar) y el mismo botón lo reanuda
- [X] Al perder todas las vidas, el canvas muestra el overlay "GAME OVER" y React abre el modal de guardar puntuación
- [X] El modal permite ingresar nombre, guardar en localStorage y reiniciar el juego limpio (score=0, lives=3, level=1)
- [X] "JUGAR DE NUEVO" reinicia el juego correctamente sin fuga de listeners o frames
- [X] El input de teclado (flechas + espacio) funciona sin necesidad de hacer clic en el canvas primero
- [X] `/juego/rocas/jugar` y el resto de IDs siguen mostrando el mock existente sin cambios
- [X] `npm run build` completa sin errores TypeScript
- [X] `npm run lint` pasa sin errores

---

## Decisions

- **Sí: mapa estático `CANVAS_GAMES` en la ruta** — `next/dynamic` con template literal en runtime no es analizable por Turbopack. Un mapa estático de imports satisface el análisis estático y sigue la convención de path (`@/components/games/[id]`) sin un archivo de registro separado.
- **Sí: ref para pausa** — Más simple que cancelar/reanudar `requestAnimationFrame`; nunca pierde el handle y no requiere reinstanciar el loop.
- **Sí: callbacks en `initGame`** — Tipados en TypeScript, explícitos, sin acoplamiento al DOM (vs. CustomEvents).
- **Sí: ambos HUDs coexisten** — El HUD del canvas se mantiene intacto por decisión del usuario; el HUD de React añade contexto de plataforma (nombre, botones).
- **Sí: `cover-rocas` y `yellow` para la tarjeta** — Reutilizar el visual existente; decisión del usuario.
- **Sí: ID `asteroides`, distinto de `rocas`** — Son dos entradas independientes en `GAMES`; `rocas` no se toca.
- **No: Supabase para scores** — Out of scope para este spec; localStorage es suficiente para el MVP del juego.
- **No: controles táctiles** — Out of scope; el juego original es 100% teclado.

---

## Risks

| Riesgo                                                                                        | Mitigación                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.ts` usa `performance.now()` en `PowerUp.draw()` — falla en SSR                          | El componente es `'use client'` y el dynamic import tiene `ssr: false`; no se ejecuta en servidor                                                                                       |
| Fuga de `keydown`/`keyup` listeners si el componente desmonta antes de que `initGame` termine | `destroy()` siempre llama `removeEventListener` con la misma referencia de función; el cleanup del `useEffect` lo llama incluso si el componente desmonta antes de la primera animación |
| El canvas pierde el foco de teclado si el usuario hace clic fuera                             | Añadir `tabIndex={0}` al wrapper del canvas; documentar en el HUD con un texto de ayuda "click aquí para enfocar" si el input se pierde                                                 |
| Turbopack no admite el mapa estático de dynamic imports por algún edge case                   | Si falla, alternativa inmediata: registro en `lib/games-registry.ts` (un archivo, cambio mínimo)                                                                                        |
