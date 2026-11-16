# SPEC 13 — Performance fixes para Frogger

> **Status:** Implemented
> **Depends on:** specs/game-jam/frogger/01-frogger-core.md (implementado, `components/games/frogger/`)
> **Date:** 2026-11-15
> **Objetivo:** Eliminar el jank de frames (sobre todo en skin Neon) y los re-renders React durante el gameplay de Frogger, corrigiendo allocaciones y `shadowBlur` en el loop RAF de `game.ts`, evitando redraws en pausa y sacando score/vidas/nivel del estado React de `index.tsx`.

---

## Por qué existe este spec

Observación subjetiva: Frogger va con jank, peor en `neon`. Causas detectadas leyendo el código actual (no hay profiling formal):

1. `frame()` en `game.ts` llama `draw()` en cada RAF aunque `paused === true`.
2. `drawEntity` fija `ctx.shadowBlur = COLORS.glow` por entidad. En `neon` (`glow: 12`) son ~45–60 shapes con blur por frame (11 carriles × ~4–5 entidades; tortugas dibujan 2 arcos por segmento). `clasico` y `retro` tienen `glow: 0`, por eso van fluidos.
3. Allocaciones por frame: `ctx.setLineDash([16, 14])` / `([])` en `drawZones`, `{ ...createFrog(), ... }` por cada boca llena en `draw()`, closure de `forEach` por carril, y `lanes.find(...)` (×2–3) en `update()`.
4. `index.tsx` guarda `score`, `lives`, `level` en `useState`: cada evento re-renderiza todo el componente (HUD, selector de skin, `<GamePad>`, modal). No es 60 fps, pero ocurre en cada fila avanzada y cada muerte, justo cuando el juego exige fluidez.

El `submergeTimer` del spec original equivalente **ya está acotado** aquí (`e.phase` usa `% TURTLE_CYCLE_MS`) y no hay `lanes.indexOf` en el hot loop: no se tocan.

---

## Scope

**In:**

- `components/games/frogger/game.ts`
  - Constantes de módulo `DASH_ROAD = [16, 14]` y `DASH_CLEAR = []` para `setLineDash`.
  - Saltar `draw()` en `frame()` mientras `paused === true` (el canvas queda congelado con el último frame; `setSkin` ya llama `draw()` directamente, así que el cambio de skin en pausa sigue funcionando).
  - Sustituir `lanes.find((l) => l.row === row)` por lookup O(1): `laneByRow: Map<number, Lane>` construido junto a `lanes` (en `initGame` y en `completeRound()` tras `buildLanes`).
  - Quitar allocaciones en `draw()`: dibujar la rana de las bocas llenas con una función que reciba `(ctx, x, row)` en vez de crear un objeto `Frog`; bucle `for` en lugar de `forEach` con closure.
  - Caché de sprites offscreen para skins con `glow > 0` (hoy solo `neon`): pre-renderizar cada tipo de entidad una vez con el blur horneado y dibujarla con `ctx.drawImage` en el loop. Se construye en `initGame` y se reconstruye en `setSkin`. Skins con `glow: 0` siguen por el camino de dibujo actual.
- `components/games/frogger/index.tsx`
  - `score`, `lives`, `level` pasan de `useState` a `useRef<number>` + refs de DOM (`scoreEl`, `livesEl`, `levelEl`); los callbacks `onScore` / `onLives` / `onLevel` escriben en ref y en `textContent`.
  - Se mantiene `useState` para `paused`, `over`, `name`, `saved`, `gameKey` (solo cambian por acción del usuario o fin de partida).
  - El modal de game over y `saveScore` usan la puntuación final desde un estado `finalScore`, fijado una sola vez al terminar (ver Decisiones).
  - `restart()` resetea refs y texto del HUD (0 / 3 / 1).
  - Sin cambios visuales en el HUD React ni en el HUD interno del canvas.

**Out:**

- Los demás juegos (Asteroides, Tetris, Arkanoid, Snake) — spec aparte si se detecta el mismo patrón.
- Offscreen canvas del fondo estático / dirty-rect rendering.
- `React.memo` sobre el componente (ver Decisiones).
- Cambios en `lib/skins.ts`, `SkinContext`, `GamePad`, paletas (`skins.ts`) o contrato `GameController` / `GameCallbacks`.
- Profiling formal con DevTools para dimensionar mejoras.

---

## Modelo de datos

No hay estructuras persistentes nuevas. Cambios internos:

- `game.ts` (módulo): `DASH_ROAD: number[]`, `DASH_CLEAR: number[]`.
- `game.ts` (`initGame`): `laneByRow: Map<number, Lane>` — reconstruido cada vez que se reasigna `lanes`.
- `game.ts` (caché neon): `interface SpriteCache` con mapas de `HTMLCanvasElement` por tipo de entidad (coche × color × ancho, camión por ancho, tronco por ancho, tortuga por ancho × sumergida) y `const SPRITE_PAD` (margen para que el blur no se recorte). Vive en el closure de `initGame`; `null` si el skin activo tiene `glow === 0`.
- `index.tsx`: `scoreRef`, `livesRef`, `levelRef: useRef<number>`; `scoreEl`, `livesEl`, `levelEl: useRef<HTMLDivElement>`; `finalScore: useState<number>`.

---

## Plan de implementación

Cada paso deja el sistema funcional. Orden: de menor a mayor riesgo.

1. **Constantes `setLineDash`** (`game.ts`)
   Añadir `DASH_ROAD` / `DASH_CLEAR` a nivel de módulo y usarlas en `drawZones`.

2. **No dibujar en pausa** (`game.ts`)
   En `frame()`: si `paused`, reprogramar RAF y `return` antes de `draw()`. `resume()` ya reinicia `lastTime`. Verificar que el modal de "EN PAUSA" (React) sigue sobre el último frame y que `setSkin` en pausa repinta.

3. **`laneByRow` y draw sin allocaciones** (`game.ts`)
   Añadir el `Map` junto a `lanes` (también en `completeRound()`); reemplazar los `lanes.find` de `checkRoadCollision` y de `update()` (río) por `laneByRow.get(row)` (pasar el mapa a `checkRoadCollision`). Extraer `drawFrogAt(ctx, x, row)` de `drawFrog` y usarlo para las bocas llenas; cambiar `forEach` por `for`.

4. **Refs en lugar de estado para HUD** (`index.tsx`)
   - Eliminar `useState` de `score`, `lives`, `level`; añadir refs de valor y de DOM.
   - Callbacks: `onScore: (s) => { scoreRef.current = s; if (scoreEl.current) scoreEl.current.textContent = s.toLocaleString("es-ES"); }`; análogo para vidas y nivel (`String(l)`).
   - `onGameOver: (final) => { scoreRef.current = final; actualizar scoreEl; setFinalScore(final); setOver(true); }`.
   - `handleEnd` (botón FIN / gamepad): `setFinalScore(scoreRef.current)` antes de `setOver(true)`.
   - JSX: `ref={scoreEl}` etc. en los `.v` del HUD con contenido inicial `0` / `3` / `1`; modal y `saveScore` leen `finalScore`.
   - `restart()`: resetear refs y `textContent` (`0`, `3`, `1`) además del `gameKey`.

5. **Caché de sprites para skins con glow** (`game.ts`)
   - `buildSpriteCache(palette)`: por cada variante, crear un `HTMLCanvasElement` de `(w·CELL + 2·SPRITE_PAD) × (CELL + 2·SPRITE_PAD)`, dibujar la entidad con el código actual de `drawEntity` (con `shadowBlur`) desplazada por `SPRITE_PAD`.
   - En `draw()`: si hay caché → `ctx.drawImage(sprite, x - SPRITE_PAD, y - SPRITE_PAD)` (tortugas sumergidas con `globalAlpha` 0.3 como hoy); si no → camino actual.
   - Construir en `initGame` y en `setSkin` (descartar caché si el nuevo skin tiene `glow === 0`).
   - Objetivo: de ~50 usos de `shadowBlur` por frame a ≤ 8 (rana, bocas llenas).

---

## Criterios de aceptación

- [X] `npm run build` y `npm run lint` pasan sin errores nuevos.
- [X] En skin Neon, 60 s de juego sin frame drops perceptibles (comparado con la rama base).
- [X] La memoria del tab (Chrome DevTools → Memory) no crece de forma continua durante 2 min de juego en skin Clásico.
- [X] En pausa, `draw()` no se ejecuta (verificable con `console.count('draw')` temporal); el canvas sigue visible bajo "EN PAUSA".
- [X] Cambiar de skin estando en pausa repinta el canvas con el nuevo skin.
- [X] El HUD React muestra puntuación, vidas y nivel correctos al avanzar filas, morir y completar ronda.
- [X] El modal de game over muestra la puntuación final correcta, tanto por muerte como por botón FIN, y `GUARDAR PUNTUACIÓN` guarda ese valor (Supabase + `av_scores_frogger`).
- [X] JUGAR DE NUEVO deja HUD y canvas en 0 / 3 / 1.
- [X] PAUSA / REANUDAR, FIN, SALIR, selector de skin y gamepad móvil funcionan igual que antes.
- [X] React DevTools Profiler: 0 re-renders de `FroggerGame` durante gameplay normal (rana moviéndose, avanzando filas, muriendo sin llegar a game over).
- [X] Visual del skin Neon idéntico al actual (sin recortes de glow en bordes de sprites).

---

## Decisiones tomadas y descartadas

- **Referencia a SPEC "performance" de otro proyecto**: se adaptó a la arquitectura real (`game.ts` vanilla + `index.tsx`; no existe `FroggerGame.tsx` monolítico ni `play/page.tsx`). Se descartan los pasos cuyo problema no existe aquí (`submergeTimer` ilimitado, `lanes.indexOf`).
- **Sprite cache incluido desde el inicio**: el diagnóstico (`shadowBlur` en `neon`) es predecible por las paletas (`glow: 12` solo en `neon`), así que se incluye en este spec en lugar de dejarlo como parche post-implementación.
- **`finalScore` como `useState` en vez de leer `scoreRef.current` en el render del modal**: leer refs durante el render es frágil y suele marcarlo `react-hooks/refs`; `finalScore` cambia una sola vez por partida, no afecta al rendimiento.
- **Sin `React.memo`**: `FroggerGame` ya solo recibe `gameId` (string estable) y es dueño del estado; no hay padre que lo re-renderice durante el juego (se carga con `dynamic`). Memoizarlo no aporta.
- **No parar el RAF al pausar**: saltar `draw()` es suficiente y evita lógica de rearranque.
- **Mantener el HUD React**: solo cambia el mecanismo de actualización (`textContent`), no el diseño.
- **Offscreen canvas del fondo estático**: descartado hasta verificar que estas correcciones bastan.

---

## Riesgos identificados

- **Canvas en pausa sin repintar**: si algún camino cambia estado visual en pausa sin llamar `draw()` (hoy solo `setSkin`, que lo hace), quedaría desactualizado. Mitigación: criterio de aceptación de skin en pausa.
- **Glow recortado en sprites**: `SPRITE_PAD` insuficiente (blur 12 + stroke) corta el halo. Mitigación: padding ≥ 2× `glow` y comprobación visual en neon.
- **Divergencia sprite vs. dibujo directo**: el sprite duplica el código de `drawEntity`. Mitigación: generar los sprites llamando a la misma función de dibujo sobre un contexto offscreen, no copiar el código.
- **HUD desincronizado tras `restart()`**: al destruir y recrear el controller, los refs y el texto deben resetearse explícitamente (paso 4); `initGame` solo emite `onLevel` al arrancar, no `onScore`/`onLives`.
- **Memoria de sprites**: ~20 canvases pequeños por skin; se liberan al cambiar de skin o destruir el juego.
