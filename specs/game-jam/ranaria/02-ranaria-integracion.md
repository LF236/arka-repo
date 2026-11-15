# SPEC GJ-ranaria-02 — RANARIA: Integración del Juego y Leaderboard

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 08, GJ-ranaria-01
> **Date:** 2026-11-15
> **Tema del jam:** cruzar
> **Objetivo:** Integrar RANARIA en Arcade Vault actualizando la ficha mock existente `ranaria`, con componente, ruta de juego, leaderboard en Supabase y registro en el catálogo.

---

## Scope

**In:**

- `lib/data.ts` — actualizar la entrada **existente** `id: "ranaria"` (no se añade otra).
- `components/games/ranaria/index.tsx` — componente cliente con HUD (puntuación, vidas, nivel), modal de game over, `insertScore`, caché `av_scores_ranaria` y nombre `av_player_name`.
- `app/juego/ranaria/jugar/page.tsx` — ruta estática con dynamic import (`ssr: false`), igual que `app/juego/snake/jugar/page.tsx`.
- `app/juego/[id]/jugar/page.tsx` — registrar `ranaria` en `CANVAS_GAMES` (igual que `snake`).
- INSERT (con `ON CONFLICT`) en la tabla `games` de Supabase con todos los campos de catálogo.
- `references/implemented-games.md` — nueva fila `ranaria`.

**Out of scope:**

- `components/games/ranaria/game.ts` (lógica y render) → GJ-ranaria-01.
- Efectos de juice, animación de salto, pantalla de inicio, aviso de nivel → GJ-ranaria-03.
- CSS nuevo: `cover-rana` ya existe en `app/globals.css`; no se toca.
- Cambios en `app/salon/page.tsx` y `app/juego/[id]/page.tsx`.
- Controles táctiles / mobile / gamepad.
- Supabase Auth (`user_id` permanece `null`) y Realtime en el leaderboard.
- Calcular `best` y `plays` desde `scores` (siguen siendo campos estáticos, SPEC 08).
- Paginación y moderación del leaderboard.

---

## Data model

### Entrada en `GAMES` (`lib/data.ts`) — reemplaza la existente

```ts
{
  id: "ranaria",
  title: "RANARIA",
  short: "Cruza la autopista y el río hasta los nichos de carga.",
  long: "Una rana-dron salta casilla a casilla entre motos, taxis y camiones en la autopista neón, y después cruza el río de datos sobre barcazas y hojas que se hunden bajo su peso. Llena los cinco nichos de carga antes de que se agote el tiempo; cada nicho te regala un Pulso que congela el tráfico cercano. Tres vidas y cada nivel más rápido. ¿Cuántas travesías aguantas?",
  cat: "ARCADE",
  cover: "cover-rana",
  color: "green",
  best: 0,
  plays: "0",
}
```

`id`, `title`, `cat`, `cover` y `color` no cambian respecto a la entrada mock. `best: 0` y `plays: "0"` reemplazan los valores inventados (18900 / 6.4K), igual que Snake y Tetris al pasar a juego real.

### SQL de INSERT en Supabase

```sql
INSERT INTO games (slug, name, active, short, long, cat, cover, color, best, plays)
VALUES (
  'ranaria',
  'RANARIA',
  true,
  'Cruza la autopista y el río hasta los nichos de carga.',
  'Una rana-dron salta casilla a casilla entre motos, taxis y camiones en la autopista neón, y después cruza el río de datos sobre barcazas y hojas que se hunden bajo su peso. Llena los cinco nichos de carga antes de que se agote el tiempo; cada nicho te regala un Pulso que congela el tráfico cercano. Tres vidas y cada nivel más rápido. ¿Cuántas travesías aguantas?',
  'ARCADE',
  'cover-rana',
  'green',
  0,
  '0'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  short = EXCLUDED.short,
  long = EXCLUDED.long,
  cat = EXCLUDED.cat,
  cover = EXCLUDED.cover,
  color = EXCLUDED.color,
  best = EXCLUDED.best,
  plays = EXCLUDED.plays;
```

El catálogo de Supabase manda sobre `lib/data.ts`: ambos textos deben ser idénticos.

### Firma del módulo de juego (idéntica al 01)

```ts
export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameController {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export function initGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameController;
```

### Componente `components/games/ranaria/index.tsx`

Props: `{ gameId: string }`. Es una copia estructural de `components/games/asteroides/index.tsx` con estas variaciones:

| Aspecto               | Asteroides                                    | RANARIA                                                  |
| --------------------- | --------------------------------------------- | -------------------------------------------------------- |
| Nombre del componente | `AsteroidesGame`                              | `RanariaGame`                                            |
| Canvas                | `width={800} height={600}`                    | `width={800} height={600}` (igual; `.crt-screen` es 4/3) |
| Slug en `insertScore` | `"asteroides"`                                | `"ranaria"`                                              |
| Clave de caché        | `av_scores_asteroides`                        | `av_scores_ranaria`                                      |
| Pie del CRT           | `ASTEROIDES · CRT-83 · 60 HZ`                 | `RANARIA · CRT-83 · 60 HZ`                               |
| Callbacks             | `onScore`, `onLives`, `onLevel`, `onGameOver` | Los mismos cuatro, sin callbacks adicionales             |
| Vidas iniciales (HUD) | 3                                             | 3 (coincide con `START_LIVES`)                           |

Estado React: `score` (0), `lives` (3), `level` (1), `paused` (false), `over` (false), `name` (inicializador perezoso desde `av_player_name`, `""` si no existe), `saved` (false), `gameKey` (0). Refs: `canvasRef`, `controllerRef`. El `useEffect` depende de `[gameKey]`, llama a `initGame` y su cleanup llama a `destroy()`.

Comportamiento: `onGameOver(finalScore)` hace `setScore(finalScore)` y `setOver(true)`. El botón FIN pausa el controller y abre el modal con el score actual. `restart` destruye el controller, resetea todo el estado (incluidas las vidas a 3 y el nivel a 1) e incrementa `gameKey`. El HUD es el mismo de asteroides (Jugador, Puntuación, Vidas con `♥`, Nivel con dos dígitos; botones PAUSA/REANUDAR, FIN, SALIR a `/juego/${gameId}`).

### Ruta y registro

- `app/juego/ranaria/jugar/page.tsx`: igual que `app/juego/snake/jugar/page.tsx`, con `dynamic(() => import("@/components/games/ranaria"), { ssr: false })` y `<RanariaGame gameId="ranaria" />`.
- `CANVAS_GAMES` en `app/juego/[id]/jugar/page.tsx`: nueva clave `ranaria` con `dynamic<{ gameId: string }>(() => import("@/components/games/ranaria"), { ssr: false })`, igual que `snake`.

### Fila para `references/implemented-games.md`

```md
| `ranaria` | RANARIA | ARCADE | green | Cruza la autopista y el río hasta los nichos de carga. |
```

### Claves `localStorage`

| Clave               | Contenido                                                          |
| ------------------- | ------------------------------------------------------------------ |
| `av_player_name`    | Último nombre escrito por el jugador (string)                      |
| `av_scores_ranaria` | Caché local de scores de RANARIA: array JSON `{ score, name, at }` |

---

## Plan de implementación

1. **Actualizar la entrada en `lib/data.ts`** — Reemplazar el objeto `ranaria` por el del Data model (misma posición en el array). Verificación: `npm run build` pasa; `/juego/ranaria` muestra la nueva descripción.
2. **Crear `components/games/ranaria/index.tsx`** — Componente `"use client"` según la tabla de variaciones. Requiere que GJ-ranaria-01 esté implementado. Verificación: `npm run build` y `npm run lint` pasan.
3. **Crear la ruta `app/juego/ranaria/jugar/page.tsx`** — Igual que la de Snake. Verificación: `/juego/ranaria/jugar` carga el canvas sin errores de SSR ni de consola.
4. **Registrar en `CANVAS_GAMES`** — Añadir `ranaria` al mapa de `app/juego/[id]/jugar/page.tsx`. Verificación: las demás rutas (`/juego/asteroides/jugar`, `/juego/snake/jugar`) siguen cargando.
5. **Registrar en Supabase** — Ejecutar el SQL del Data model con `mcp__supabase__execute_sql`. Verificación: `SELECT slug, name, active, cat, cover, color, best, plays FROM games WHERE slug = 'ranaria'` devuelve la fila con todos los campos.
6. **Actualizar `references/implemented-games.md`** — Añadir la fila de `ranaria`. Verificación: la tabla renderiza con 5 filas.
7. **Prueba de integración** — Jugar una partida completa hasta game over, guardar el score y revisar `/salon` y `/juego/ranaria`. Verificación: los criterios de aceptación de abajo.

---

## Criterios de aceptación

- [ ] `lib/data.ts` contiene una sola entrada `id: "ranaria"` con `title: "RANARIA"`, `cat: "ARCADE"`, `cover: "cover-rana"`, `color: "green"`, `best: 0`, `plays: "0"` y los textos del Data model.
- [ ] La fila de Supabase `slug = 'ranaria'` tiene `active = true` y todos los campos de catálogo con el mismo texto que `lib/data.ts`.
- [ ] `/juego/ranaria/jugar` carga sin errores de SSR ni de consola y `/juego/ranaria` (ficha) lo enlaza a la ruta de juego.
- [ ] `CANVAS_GAMES` incluye `ranaria` y la ruta dinámica `[id]/jugar` también carga el canvas.
- [ ] El canvas es 800×600 y se ve completo dentro del marco CRT.
- [ ] El HUD muestra puntuación, 3 `♥` al inicio y nivel `01`; las vidas bajan al morir y el nivel sube al llenar los 5 nichos.
- [ ] Al perder la tercera vida aparece el modal de game over con la puntuación final.
- [ ] PAUSA congela rana y obstáculos; REANUDAR continúa sin salto; FIN abre el modal.
- [ ] El modal pre-llena el nombre desde `localStorage.getItem("av_player_name")`.
- [ ] Al guardar, el score aparece en Supabase (`SELECT * FROM scores WHERE game_slug = 'ranaria'`), el nombre se persiste en `av_player_name` y el score en `av_scores_ranaria`.
- [ ] Si `insertScore` falla, el modal igualmente muestra "PUNTUACIÓN GUARDADA" y el score queda en `av_scores_ranaria`.
- [ ] "JUGAR DE NUEVO" reinicia con score 0, 3 vidas y nivel 1, sin fugas de rAF ni listeners (una sola pulsación mueve una casilla).
- [ ] Las flechas y el espacio no hacen scroll de la página durante el juego.
- [ ] `/salon` muestra la pestaña `RANARIA` y filtra sus scores.
- [ ] `/juego/ranaria` muestra el leaderboard lateral con datos de Supabase (o estado vacío).
- [ ] `/biblioteca` muestra RANARIA una sola vez.
- [ ] Los juegos existentes (asteroides, tetris, arkanoid, snake) siguen funcionando sin cambios.
- [ ] `references/implemented-games.md` incluye la fila `ranaria`.
- [ ] `npm run build` completa sin errores TypeScript.
- [ ] `npm run lint` pasa sin errores.

---

## Decisiones

- **Sí: actualizar la entrada mock `ranaria` en lugar de añadir otra** — El id ya está ocupado a propósito. Mantener un solo `ranaria` evita duplicados en `/biblioteca` y conserva id, título, categoría, color y cover.
- **Sí: `cover-rana` reutilizado** — Ya existe en `app/globals.css` (carriles cian y círculo verde) y representa exactamente un cruce con la rana; no se necesita CSS nuevo.
- **Sí: color `green`** — Se conserva el de la entrada; además es el menos usado entre los juegos reales (0 frente a 1–2) y en `lib/data.ts` hay empate a 3 por color (ver GJ-ranaria-01).
- **Sí: `best: 0` y `plays: "0"`** — Los 18900 / 6.4K eran datos de mock; un juego real arranca sin historial, como Snake y Tetris.
- **Sí: ruta estática `app/juego/ranaria/jugar/page.tsx` y registro en `CANVAS_GAMES`** — Ambos, como `snake`: la ruta estática tiene prioridad en Next.js y el mapa mantiene coherente la ruta dinámica `[id]/jugar`.
- **Sí: mismos cuatro callbacks que asteroides** — RANARIA tiene vidas y niveles, así que el componente es una copia estructural y se minimizan variaciones (solo slug, claves y pie del CRT).
- **Sí: `INSERT ... ON CONFLICT DO UPDATE`** — Hace el paso 5 idempotente si la fila ya se creó a mano o se reintenta la migración.
- **Sí: `/salon` y `/juego/[id]` sin cambios** — Ambas páginas leen el catálogo y los scores de Supabase por `slug` (SPEC 06 y 08); basta con que exista la fila `active` en `games`.
- **Sí: canvas 800×600 sin CSS nuevo** — Coincide con `aspect-ratio: 4/3` de `.crt-screen`.
- **No: modificar `app/globals.css`** — No hay cover nuevo; cualquier CSS de presentación pertenece al canvas (GJ-ranaria-03).
- **No: nuevo callback para las cargas de Pulso** — Se dibujan dentro del canvas (franja de estado); el HUD externo no necesita ese dato.

---

## Riesgos

| Riesgo                                                           | Mitigación                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SSR del canvas (`window`/`localStorage` indefinidos en servidor) | Dynamic import con `{ ssr: false }` en la ruta estática y en `CANVAS_GAMES`                              |
| Fallo de `insertScore` en Supabase                               | `insertScore` no lanza (degrada); el score se guarda igualmente en `av_scores_ranaria`                   |
| Timers, rAF o listeners tras desmontar                           | Cleanup del `useEffect` llama a `destroy()` (idempotente); `restart` también lo llama sin efectos dobles |
| Texto de catálogo distinto entre `lib/data.ts` y Supabase        | El mismo texto se copia en ambos; criterio de aceptación lo verifica                                     |
| Dos entradas `ranaria` en `GAMES` o en `games`                   | Se edita la entrada existente; `slug` es único y el SQL usa `ON CONFLICT`                                |
| Romper juegos existentes al editar `CANVAS_GAMES`                | Solo se añade una clave al objeto; criterio de aceptación comprueba los demás juegos                     |
| Foco del teclado perdido tras clicar PAUSA                       | Los listeners viven en `window`, no en el canvas; no depende del foco                                    |
