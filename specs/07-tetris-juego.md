# SPEC 07 — TETRIS: Integración del Juego y Leaderboard

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-13
> **Objetivo:** Integrar el juego TETRIS (canvas vanilla JS, dos canvases) en la plataforma Arcade Vault con leaderboard conectado a Supabase.

---

## Scope

**In:**

- Entrada en `lib/data.ts` con `id: 'tetris'` y todos los campos de la interfaz `Game`
- `components/games/tetris/game.ts` — adaptación de `references/started-games/03-tetris/game.js` a TypeScript, exponiendo `initGame(boardCanvas, nextCanvas, callbacks): GameController`
- `components/games/tetris/index.tsx` — componente React `'use client'` con dos canvases (tablero + preview), HUD externo, modal de game over con `insertScore` y cache en `av_scores_tetris`, pre-llenado de nombre desde `av_player_name`
- `app/juego/tetris/jugar/page.tsx` — dynamic import del componente con `{ ssr: false }`
- Entrada en el mapa `CANVAS_GAMES` de `app/juego/[id]/jugar/page.tsx` para el slug `tetris`
- INSERT en Supabase tabla `games`: `{ slug: 'tetris', name: 'TETRIS', active: true }`

**Out of scope:**

- Lógica del juego (proviene de `references/started-games/03-tetris/game.js`)
- Assets gráficos o sonidos
- Autenticación (`user_id` permanece `null`)
- Cambios en `app/salon/page.tsx` o `app/juego/[id]/page.tsx` (ya manejan cualquier juego real de Supabase sin modificación)
- Columna extra `lines` en la tabla `scores` (score acumulado es suficiente)
- Paginación del leaderboard
- Moderación de scores
- Tocar el placeholder existente `caida` en `lib/data.ts`

---

## Data model

### Nueva entrada en `GAMES` (`lib/data.ts`)

```ts
{
  id: 'tetris',
  title: 'TETRIS',
  short: 'Encaja los 7 tetrominos clásicos sin que el pozo se llene.',
  long: 'Siete piezas caen desde las alturas: encástralas sin huecos para limpiar líneas y sumar puntos. Pieza fantasma y hard drop te dan control total; la velocidad aumenta cada 10 líneas. ¿Cuánto aguantas cuando el techo no perdona?',
  cat: 'PUZZLE',
  cover: 'cover-tetro',
  color: 'cyan',
  best: 0,
  plays: '0',
}
```

### SQL de INSERT en Supabase

```sql
INSERT INTO games (slug, name, active) VALUES ('tetris', 'TETRIS', true);
```

### Interfaz del módulo de juego

Tetris no tiene vidas; el callback equivalente expone las líneas limpiadas:

```ts
// components/games/tetris/game.ts

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLines: (lines: number) => void; // en lugar de onLives — Tetris no tiene vidas
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initGame(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameController;
```

### Dos canvases

| Canvas        | Dimensiones | Propósito                     |
| ------------- | ----------- | ----------------------------- |
| `boardCanvas` | 300 × 600   | Tablero de juego principal    |
| `nextCanvas`  | 120 × 120   | Preview de la siguiente pieza |

### localStorage keys

| Key                | Contenido                                                    |
| ------------------ | ------------------------------------------------------------ |
| `av_player_name`   | Último nombre escrito (compartido con todos los juegos)      |
| `av_scores_tetris` | Cache local de scores de TETRIS (array JSON — mismo formato) |

---

## Plan de implementación

1. **Añadir entrada en `lib/data.ts`** — Insertar el objeto `Game` para `tetris` (ver Data model) en el array `GAMES`. El placeholder `caida` no se toca. Verificación: `npm run build` compila; `/juego/tetris` carga la ficha con título "TETRIS".

2. **Crear `components/games/tetris/game.ts`** — Adaptar `references/started-games/03-tetris/game.js` a TypeScript:
   - Reemplazar `document.getElementById('board')` y `document.getElementById('next-canvas')` por los parámetros `boardCanvas` y `nextCanvas` recibidos en `initGame`.
   - Reemplazar los `addEventListener` globales de `keydown` por listeners registrados dentro de `initGame` y eliminados en `destroy()`.
   - Añadir el parámetro `callbacks: GameCallbacks`; invocarlos en los puntos correctos:
     - `callbacks.onScore(score)` — cada vez que `score` cambia (tras `clearLines`).
     - `callbacks.onLines(lines)` — cada vez que el contador de líneas totales cambia.
     - `callbacks.onLevel(level)` — cada vez que `level` sube.
     - `callbacks.onGameOver(score)` — al final de `endGame()`.
   - Añadir variable interna `let paused = false`; `pause()` y `resume()` la alternan; el game loop la chequea cada frame antes de actualizar estado.
   - `destroy()` llama `cancelAnimationFrame(animId)` y elimina los listeners de teclado.
   - `initGame` retorna `{ pause, resume, destroy }`.
   - Verificación: TypeScript compila sin errores; `npm run lint` pasa.

3. **Crear `components/games/tetris/index.tsx`** — Componente `'use client'` siguiendo el patrón de `components/games/asteroides/index.tsx`:
   - Props: `{ gameId: string }`.
   - Estado React: `score` (init 0), `lines` (init 0), `level` (init 1), `paused`, `over`, `name`, `saved`.
   - `boardCanvasRef`: `useRef<HTMLCanvasElement>(null)`.
   - `nextCanvasRef`: `useRef<HTMLCanvasElement>(null)`.
   - `controllerRef`: `useRef<GameController | null>(null)`.
   - `useEffect` (monta/desmonta): llama `initGame(boardCanvas, nextCanvas, callbacks)`, guarda el controller, retorna `() => controllerRef.current?.destroy()`.
   - Botón PAUSA: alterna `paused`, llama `controller.pause()` o `controller.resume()`.
   - Botón FIN: llama `controller.pause()`, `setOver(true)`.
   - Modal de game over: input de nombre + "GUARDAR PUNTUACIÓN" + "JUGAR DE NUEVO". Al guardar: `insertScore('tetris', name, score)` + cache en `av_scores_tetris` + `localStorage.setItem('av_player_name', name)`. Pre-llenado del nombre desde `localStorage.getItem('av_player_name')`.
   - "JUGAR DE NUEVO": `controller.destroy()`, reinicia estado React, re-monta el juego (key en canvas o nueva llamada a `initGame`).
   - HUD externo: nombre, score, **líneas limpias**, nivel, botones PAUSA/FIN/SALIR. Reemplaza el ♥ de vidas por el contador de líneas.
   - Layout: `boardCanvas` (300×600) y `nextCanvas` (120×120) dentro del `.crt > .crt-screen`.
   - Ambos canvases reciben `tabIndex={0}` en su wrapper para que el foco de teclado funcione.
   - Verificación: el canvas aparece, el juego responde a teclas, el HUD se actualiza en tiempo real.

4. **Crear `app/juego/tetris/jugar/page.tsx`** — Dynamic import del componente con `{ ssr: false }`, igual que `app/juego/asteroides/jugar/page.tsx`. Verificación: la ruta `/juego/tetris/jugar` carga sin errores de SSR.

5. **Registrar en el mapa `CANVAS_GAMES`** — En `app/juego/[id]/jugar/page.tsx`, añadir la entrada `tetris` al mapa estático:

   ```ts
   tetris: dynamic(() => import("@/components/games/tetris"), { ssr: false }),
   ```

   Verificación: `/juego/tetris/jugar` carga el canvas; el resto de IDs no cambian.

6. **Registrar en Supabase** — Ejecutar el INSERT via `mcp__supabase__execute_sql`. Verificación: `SELECT * FROM games WHERE slug = 'tetris'` devuelve la fila.

7. **Verificar integración completa** — `npm run build` y `npm run lint` pasan; `/juego/tetris/jugar` carga y registra scores; `/salon` muestra tab `TETRIS`; `/juego/tetris` muestra leaderboard lateral; los juegos existentes (asteroides, etc.) no se rompen.

---

## Criterios de aceptación

- [ ] `lib/data.ts` incluye la entrada `{ id: 'tetris', color: 'cyan', cat: 'PUZZLE', ... }` con todos los campos
- [ ] El placeholder `caida` en `lib/data.ts` no ha sido modificado
- [ ] `components/games/tetris/game.ts` exporta `initGame` con la firma `(boardCanvas, nextCanvas, callbacks): GameController`
- [ ] `components/games/tetris/index.tsx` renderiza el tablero (300×600) y el preview (120×120) sin errores
- [ ] El HUD externo muestra score, líneas limpias y nivel — se actualizan en tiempo real durante la partida
- [ ] El botón PAUSA congela el juego (canvas deja de animar) y el mismo botón lo reanuda
- [ ] `/juego/tetris/jugar` carga sin errores de SSR ni de consola
- [ ] Al terminar una partida, el score aparece en Supabase: `SELECT * FROM scores WHERE game_slug = 'tetris'`
- [ ] El modal pre-llena el nombre desde `localStorage.getItem('av_player_name')`
- [ ] Al guardar, el nombre se persiste en `av_player_name` y el score en `av_scores_tetris`
- [ ] `/salon` muestra tab `TETRIS` y filtra scores del juego
- [ ] `/juego/tetris` muestra leaderboard lateral con datos de Supabase (o estado vacío si no hay scores)
- [ ] Los juegos ya existentes (asteroides, etc.) siguen funcionando sin cambios
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `npm run lint` pasa sin errores

---

## Decisiones

- **Spec combinado (juego + leaderboard)** — TETRIS sigue el mismo patrón que SPEC 05 + SPEC 06 combinados en uno. El patrón ya está consolidado; separarlo en dos specs añadiría overhead sin beneficio.
- **Páginas `/salon` y `/juego/[id]/page.tsx` sin cambios** — SPEC 06 diseñó ambas páginas para leer juegos activos desde Supabase genéricamente. Registrar `tetris` en la tabla `games` es suficiente para que aparezca en tabs y leaderboard lateral.
- **`onLines` en lugar de `onLives`** — Tetris no tiene vidas; el equivalente informativo es el contador de líneas limpiadas. El HUD externo muestra líneas en lugar del ♥. La firma de `GameCallbacks` difiere de asteroides en este punto.
- **Dos canvases** — El original usa `<canvas id="board">` y `<canvas id="next-canvas">`. Se mantienen ambos para ser fiel a la referencia y dar al jugador la preview de pieza siguiente, que es central en la experiencia de Tetris.
- **Score solo para Supabase** — Las líneas limpiadas se muestran en el HUD durante la partida pero no se persisten. El campo `score` es suficiente para ordenar el leaderboard; añadir `lines` requeriría una migración extra que no aporta valor para el MVP.
- **Slug `tetris`, color `cyan`** — El usuario confirmó ambos. `cyan` diferencia visualmente este juego del placeholder `caida` (magenta) en la biblioteca.
- **Cover `cover-tetro`** — La clase CSS ya existe en el proyecto (usada por `caida`). Reutilizarla evita añadir un asset nuevo.
- **Coexistencia con `caida`** — El placeholder `caida` permanece en `lib/data.ts` como juego mock. `tetris` es una entrada independiente con implementación real. Reemplazar `caida` está fuera de scope de este spec.

---

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SSR del canvas (window/document undefined en servidor)                                   | Dynamic import con `{ ssr: false }` en la página de juego                                               |
| Fallo de `insertScore` en Supabase                                                       | Error silencioso (`console.error`); el score se guarda igualmente en `av_scores_tetris`                 |
| El canvas de preview pierde el contexto si el componente se desmonta antes de `initGame` | `destroy()` siempre llama `cancelAnimationFrame` antes de que el componente desmonte                    |
| El canvas principal pierde el foco de teclado si el usuario hace clic en el preview      | `boardCanvas` recibe `tabIndex={0}` y `autoFocus`; `nextCanvas` no es interactivo                       |
| Turbopack no reconoce la nueva entrada en `CANVAS_GAMES`                                 | Si falla, alternativa inmediata: registro en `lib/games-registry.ts` (patrón ya documentado en SPEC 05) |
