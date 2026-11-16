# SPEC — Frogger: Integración del Juego y Leaderboard

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 08
> **Date:** 2026-11-15
> **Objetivo:** Integrar Frogger (canvas vanilla TS escrito desde cero, 640×560, cuadrícula 16×14) en Arcade Vault con ID `frogger`, vidas, niveles y leaderboard conectado a Supabase.

---

## Por qué existe este spec

Versión adaptada a las convenciones actuales del proyecto (`game.ts` + `index.tsx`, rutas `/juego/<slug>/jugar`, esquema `games` con `slug`/`name`). Sustituye al borrador original del game-jam, que usaba rutas y esquema antiguos.

---

## Scope

**In:**

- `lib/data.ts` — nueva entrada `id: 'frogger'` en `GAMES` (la entrada mock `ranaria` queda intacta).
- `app/globals.css` — clases `.cover-frogger` y `.cover-frogger::after` (patrón de `.cover-snake`).
- `components/games/frogger/game.ts` — lógica vanilla TS sin React, `initGame(canvas, callbacks): GameController`. Todo se dibuja con primitivas canvas; no hay imágenes.
- `components/games/frogger/index.tsx` — componente `({ gameId })` con HUD React (jugador, puntuación, vidas, nivel), PAUSA/FIN/SALIR, modal de game over, `insertScore` + cache `av_scores_frogger`, nombre desde `av_player_name`, `gameKey` para reiniciar.
- `app/juego/frogger/jugar/page.tsx` — ruta estática con `dynamic(..., { ssr: false })`.
- Registro `frogger` en `CANVAS_GAMES` de `app/juego/[id]/jugar/page.tsx`.
- INSERT en Supabase tabla `games` (con campos de catálogo).
- `references/implemented-games.md` — fila nueva.

**Out of scope (para specs futuros):**

- Skins (`clasico`/`neon`/`retro`): las implementa el agente `skin-designer`.
- Controles táctiles / gamepad / layout móvil: los porta el agente `mobile-porter`.
- Sprites bitmap o assets externos.
- Animaciones de muerte elaboradas y partículas.
- Mosca bonus en las bocas y cocodrilo disfrazado de tronco.
- Efectos de sonido.
- Autenticación (`user_id` permanece `null`).
- Cambios en `app/salon/page.tsx` o `app/juego/[id]/page.tsx` (ya manejan cualquier juego real de Supabase).
- Paginación y moderación del leaderboard.

---

## Data model

### Nueva entrada en `GAMES` (`lib/data.ts`)

```ts
{
  id: "frogger",
  title: "FROGGER",
  short: "Cruza la carretera y el río sin convertirte en papilla.",
  long: "Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.",
  cat: "ARCADE",
  cover: "cover-frogger",
  color: "green",
  best: 0,
  plays: "0",
}
```

`color: "green"` (el tipo `Game` no admite `lime`; es el color neon sin juego real).

### SQL de INSERT en Supabase

```sql
INSERT INTO games (slug, name, active, short, long, cat, cover, color, best, plays)
VALUES (
  'frogger',
  'FROGGER',
  true,
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE',
  'cover-frogger',
  'green',
  0,
  '0'
);
```

El catálogo de Supabase manda sobre `lib/data.ts`, por eso el INSERT lleva todos los campos.

### Interfaz del módulo de juego

```ts
export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // cada vez que cambia (muerte)
  onLevel: (level: number) => void; // al iniciar cada ronda
  onGameOver: (finalScore: number) => void;
}

export interface GameController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}
```

Variación respecto a asteroides: añade `onLives` y `onLevel`; sin `onLines`. `setSkin` no existe todavía (lo añade `skin-designer`).

### Constantes y tipos (locales a `game.ts`, no exportados)

```ts
const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640
const CANVAS_H = ROWS * CELL; // 560
// Filas (0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6; // 6 carriles de río
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12; // 5 carriles de carretera
const ROW_START = 13;
const START_COL = 8;
const GOAL_COLS = [1, 4, 7, 10, 13]; // 5 bocas de 2 columnas cada una

type Direction = "up" | "down" | "left" | "right";
interface Entity {
  x: number; // celdas, float; borde izquierdo
  width: number; // celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  phase?: number; // ms acumulados en el ciclo de inmersión
}
interface Lane {
  row: number;
  speed: number; // celdas/s, siempre positivo
  dir: 1 | -1;
  entities: Entity[];
}
interface Frog {
  x: number; // celdas, float (la arrastra el soporte)
  row: number;
  animating: boolean;
  animT: number; // ms
  targetX: number;
  targetRow: number;
}
```

Convenciones:

- Origen arriba-izquierda; posiciones en celdas, se multiplican por `CELL` solo al dibujar.
- Velocidades en celdas/s, `dt` en ms (`x += speed * dir * dt / 1000`).
- Centro de la rana = `frog.x + 0.5`; una entidad cubre `[x, x + width)`.

### Reglas de juego (decisiones numéricas)

- Velocidad base: carretera 2.25–6 celdas/s, río 1.5–4.5 celdas/s, atenuadas ×0.7 (`BASE_SPEED_SCALE`; resultado 1.6–4.2 y 1.05–3.15); ×`(1 + 0.15 × (level − 1))`, tope ×2.5.
- Temporizador de ronda: `max(8, 16 − level)` segundos (15 s en nivel 1).
- Tortugas: 3 s visibles / 1.5 s sumergidas, fase independiente por grupo.
- Puntuación: +10 por fila nueva alcanzada (se reinicia el récord de fila en cada reaparición y ronda); +50 por boca; +`floor(tiempo_restante) × 10` por boca; +200 al completar la ronda.

---

## Plan de implementación

1. **Entrada en `lib/data.ts` y portada CSS** — añadir el objeto `Game` a `GAMES` y `.cover-frogger` a `app/globals.css` (ranas/troncos con gradientes, estilo `.cover-snake`). Verificación: `npm run build` compila; `/biblioteca` muestra la card.
2. **`game.ts` — esqueleto, carriles y render** — constantes, tipos, `buildLanes(level)`, `initGame` con loop `requestAnimationFrame`, `draw()` de zonas, entidades y HUD interno; las entidades se mueven y se reintroducen por el lado opuesto. Verificación: montar temporalmente en la ruta y ver tráfico, troncos y tortugas en loop; cada carril tiene ≥ 2 entidades con huecos.
3. **`game.ts` — rana e input** — listener `keydown` en `document` (flechas, `preventDefault`, un `pendingDir` buffer), salto de 1 celda en 120 ms, clamp en bordes laterales, dibujo de la rana. Las teclas P/Esc no se manejan. Verificación: la rana salta una celda por pulsación y no sale por los lados.
4. **`game.ts` — colisiones, río y muerte** — `checkRoadCollision`, `getSupport` (con inmersión de tortugas), arrastre de la rana por el soporte, muerte por vehículo, agua, tortuga sumergida, salir por los bordes y temporizador; `killFrog()` con `onLives` y respawn en `ROW_START`/`START_COL`. Verificación: cada causa de muerte resta una vida.
5. **`game.ts` — metas, puntuación y rondas** — `checkGoal`, bocas ocupadas, puntuación, `completeRound()` (incrementa nivel, `onLevel`, reconstruye carriles, reinicia temporizador), fin de partida (`onLives(0)` y luego `onGameOver(score)`), `pause`/`resume`/`destroy` (quita el listener y cancela el loop). Verificación: llenar 5 bocas sube el nivel; al llegar a 0 vidas aparece game over.
6. **`index.tsx`** — patrón de `components/games/snake/index.tsx`: refs de canvas y controller, estados `score`/`lives`(3)/`level`/`paused`/`over`/`name`/`saved`/`gameKey`, HUD React, modal de game over, `insertScore("frogger", name, score)`, cache `av_scores_frogger`, persistencia de `av_player_name`. Verificación: el HUD refleja valores en tiempo real.
7. **Ruta y registro** — `app/juego/frogger/jugar/page.tsx` con `dynamic(..., { ssr: false })` y entrada `frogger` en `CANVAS_GAMES`. Verificación: `/juego/frogger/jugar` carga sin errores de SSR.
8. **INSERT en Supabase** — ejecutar el SQL del data model con `mcp__supabase__execute_sql`. Verificación: `SELECT * FROM games WHERE slug = 'frogger'` devuelve la fila.
9. **Documentación** — añadir fila `frogger` a `references/implemented-games.md`.

---

## Acceptance criteria

- [X] `lib/data.ts` incluye la entrada `{ id: 'frogger', ... }` con todos los campos y `color: 'green'`.
- [X] La fila `frogger` existe en `games` con los campos de catálogo.
- [X] La card de Frogger aparece en `/biblioteca` con `cover-frogger`.
- [X] `components/games/frogger/game.ts` exporta `initGame` con la firma `GameController` (`pause`, `resume`, `destroy`).
- [X] `/juego/frogger/jugar` carga sin errores de SSR ni de consola.
- [X] El canvas (640×560) muestra bocas, río, zona segura central, carretera y zona de inicio diferenciadas.
- [X] La rana aparece en `ROW_START`, columna 8, al cargar.
- [X] La rana salta una celda por pulsación de flecha con animación de 120 ms y no sale por los bordes laterales.
- [X] Coches, camiones, troncos y tortugas se mueven en loop y reaparecen por el lado opuesto.
- [X] Las tortugas alternan visible (3 s) y sumergida (1.5 s).
- [X] La rana muere por: vehículo, agua, tortuga sumergida bajo ella, salir por los bordes del río arrastrada, y tiempo agotado.
- [X] Al morir, `onLives(lives)` se dispara y la rana vuelve a la fila de inicio con el temporizador reiniciado.
- [X] Llegar a una boca libre la marca y suma +50 y el bonus de tiempo; llegar a una ocupada o fuera de boca mata.
- [X] Al llenar las 5 bocas: +200, `onLevel(level + 1)`, bocas vacías y carriles reconstruidos.
- [X] La velocidad sube y el temporizador baja con cada nivel.
- [X] `onScore` se dispara en cada cambio de puntuación.
- [X] El HUD interno del canvas (score, nivel, vidas, barra de tiempo) se dibuja correctamente.
- [X] El HUD React refleja score, vidas y nivel en tiempo real.
- [X] PAUSA congela la lógica; REANUDAR la reanuda. P y Esc no pausan por su cuenta.
- [X] Con 0 vidas se disparan `onLives(0)` y luego `onGameOver(score)`; aparece el modal.
- [X] El modal pre-llena el nombre desde `av_player_name`.
- [X] Al guardar, el score se inserta en Supabase, el nombre se persiste y el score se añade a `av_scores_frogger`.
- [X] El botón de guardar se deshabilita tras el primer envío.
- [X] JUGAR DE NUEVO reinicia desde cero (nuevo `gameKey`) sin listeners duplicados.
- [X] `/salon` muestra la tab FROGGER y `/juego/frogger` muestra el leaderboard lateral.
- [X] `references/implemented-games.md` incluye `frogger`.
- [X] Los juegos existentes siguen funcionando.
- [X] `npm run build` y `npm run lint` pasan sin errores.

---

## Decisions

- **Yes:** spec único juego + leaderboard, como SPEC 10. Razón: `/salon` y `/juego/[id]` ya son genéricos; no hay trabajo de leaderboard aparte.
- **Yes:** patrón `game.ts` + `index.tsx` con `initGame(canvas, callbacks)`. Razón: canónico del proyecto; el HUD externo en React y el controller por ref.
- **Yes:** callbacks `onLives` y `onLevel` además de `onScore`/`onGameOver`. Razón: HUD React de vidas y nivel.
- **Yes:** primitivas canvas sin sprites. Razón: no hay assets de Frogger y se evita carga de imágenes.
- **Yes:** cuadrícula 16×14 de 40 px, canvas 640×560. Razón: el original tenía contradicción 480×640 vs 640×560; el plan y los criterios ya usaban 640×560.
- **Yes:** zona segura central en fila 7 y bocas en fila 0. Razón: las constantes del spec original suman 14 filas con esa distribución; la variante "bocas en fila 1 + barra de tiempo en fila 0" dejaba sin mediana.
- **Yes:** HUD interno dentro de la fila de inicio (score, nivel, vidas y barra de tiempo en su borde inferior). Razón: las 14 filas están ocupadas por zonas de juego.
- **Yes:** posición de la rana en float y salto desde `round(x)`. Razón: el soporte la arrastra a velocidad continua; el salto vuelve a alinearla a la cuadrícula.
- **Yes:** velocidades en celdas/s con `dt` en ms. Razón: independiente de la tasa de refresco.
- **Yes:** velocidades base ×0.7 (`BASE_SPEED_SCALE`). Razón: las del spec original resultaban demasiado rápidas al probar; ajuste pedido por el usuario.
- **Yes:** temporizador `max(8, 16 − level)` s y velocidad +15 % por nivel con tope ×2.5. Razón: el spec original dejaba "reducido en niveles altos" sin cifra.
- **Yes:** récord de fila para los +10 se reinicia en cada reaparición. Razón: sin esto, tras morir la rana no volvería a puntuar al avanzar.
- **Yes:** `color: 'green'`. Razón: `lime` no existe en el tipo `Game`.
- **Yes:** ruta estática `app/juego/frogger/jugar/` y entrada en `CANVAS_GAMES`. Razón: convención de CLAUDE.md.
- **Yes:** mantener la entrada mock `ranaria`. Razón: mismo criterio que `serpentina` en SPEC 10.
- **No:** controles táctiles y skins en este spec. Razón: los cubren `mobile-porter` y `skin-designer` en `/spec-impl-game`.
- **No:** movimiento continuo de la rana. Razón: colisiones por celda más simples y fieles al original.
- **No:** mosca bonus ni cocodrilo. Razón: capas de dificultad independientes de la mecánica base.
- **No:** componente genérico `CanvasGame`. Razón: YAGNI.

---

## Riesgos

| Riesgo                                                   | Mitigación                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| SSR del canvas (`window`/`document` indefinidos)         | `dynamic(..., { ssr: false })` en la página de juego y en `CANVAS_GAMES` |
| Fallo de `insertScore` en Supabase                       | Degradación silenciosa; el score se guarda igual en localStorage         |
| Flechas hacen scroll de la página                        | `preventDefault` en el `keydown` de las flechas                          |
| Listener `keydown` duplicado al reiniciar                | `destroy()` lo elimina; el `useEffect` depende de `gameKey`              |
| Rana arrastrada fuera del canvas por tronco/tortuga      | Muerte si el centro de la rana sale de `[0, COLS)`                       |
| Carriles imposibles de cruzar al subir la velocidad      | Huecos mínimos de 1 celda en `buildLanes` y tope de velocidad ×2.5       |
| Tabs en segundo plano disparan `dt` enorme (rana tunela) | Limitar `dt` a 50 ms por frame en el loop                                |

---

## What is **not** in this spec

- Skins (`skin-designer`).
- Gamepad y layout móvil (`mobile-porter`).
- Sonido, partículas, mosca bonus, cocodrilo.
- Autenticación y moderación de scores.
- Realtime en el leaderboard.

Cada uno, si llega, va en su propio spec o agente.
