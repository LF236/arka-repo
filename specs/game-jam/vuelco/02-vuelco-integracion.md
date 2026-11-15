# SPEC GJ-vuelco-02 — VUELCO: Integración en la Plataforma y Leaderboard

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 08, GJ-vuelco-01
> **Date:** 2026-11-14
> **Tema del jam:** gravedad invertida
> **Objetivo:** Integrar VUELCO en Arcade Vault con entrada de catálogo, componente React, ruta de juego y leaderboard conectado a Supabase.

---

## Scope

**In:**

- `lib/data.ts` — nueva entrada con `id: 'vuelco'` en el array `GAMES`
- `app/globals.css` — nueva clase `cover-vuelco` junto al resto de `cover-*`
- `components/games/vuelco/index.tsx` — componente cliente con HUD, modal de game over, `insertScore`, cache `av_scores_vuelco` y pre-llenado desde `av_player_name`
- `app/juego/vuelco/jugar/page.tsx` — ruta de juego con dynamic import `{ ssr: false }`
- `app/juego/[id]/jugar/page.tsx` — entrada `vuelco` en el mapa `CANVAS_GAMES`
- INSERT en la tabla `games` de Supabase con los campos de catálogo
- `references/implemented-games.md` — nueva fila para `vuelco`

**Out of scope:**

- Lógica del juego en `components/games/vuelco/game.ts` → GJ-vuelco-01
- Efectos visuales, pantalla de inicio y cualquier cambio en `game.ts` → GJ-vuelco-03
- Cambios en `app/salon/page.tsx` o `app/juego/[id]/page.tsx` (ya manejan cualquier juego activo de Supabase)
- Cambios en `lib/supabase/leaderboard.ts`
- Autenticación (`user_id` permanece `null`)
- Controles táctiles / gamepad
- Efectos de sonido
- Paginación y moderación del leaderboard

---

## Data model

### Nueva entrada en `GAMES` (`lib/data.ts`)

```ts
{
  id: "vuelco",
  title: "VUELCO",
  short: "Invierte la gravedad y corre por el techo.",
  long: "Un cubo corre sin freno por un pasillo de neón lleno de huecos, púas y barreras. No puedes saltar: solo volcar la gravedad para caer hacia el techo o volver al suelo. Atrapa chispas en pleno vuelo para encadenar rachas mientras el pasillo acelera. ¿Cuántos metros aguantas antes de caer al vacío?",
  cat: "ARCADE",
  cover: "cover-vuelco",
  color: "green",
  best: 0,
  plays: "0",
}
```

### SQL de INSERT en Supabase

```sql
INSERT INTO games (slug, name, active, short, long, cat, cover, color, best, plays)
VALUES (
  'vuelco',
  'VUELCO',
  true,
  'Invierte la gravedad y corre por el techo.',
  'Un cubo corre sin freno por un pasillo de neón lleno de huecos, púas y barreras. No puedes saltar: solo volcar la gravedad para caer hacia el techo o volver al suelo. Atrapa chispas en pleno vuelo para encadenar rachas mientras el pasillo acelera. ¿Cuántos metros aguantas antes de caer al vacío?',
  'ARCADE',
  'cover-vuelco',
  'green',
  0,
  '0'
);
```

### CSS del cover (`app/globals.css`)

Se añade tras el último bloque `cover-*` de la sección "Cover art generators". Representa el pasillo: techo completo, suelo con un hueco y el cubo pegado al techo.

```css
.cover-vuelco {
  background:
    linear-gradient(#00ff88, #00ff88) 0 0 / 100% 12% no-repeat,
    linear-gradient(#00ff88, #00ff88) 0 100% / 58% 12% no-repeat,
    radial-gradient(circle at 50% 50%, #062a1c, #0a0a18);
}
.cover-vuelco::after {
  content: "";
  position: absolute;
  left: 24%;
  top: 12%;
  width: 14%;
  aspect-ratio: 1;
  background: #e6e9ff;
  box-shadow: 0 0 14px rgba(0, 255, 136, 0.8);
}
```

### Interfaz del módulo de juego (definida en GJ-vuelco-01)

```ts
// components/games/vuelco/game.ts

export interface GameCallbacks {
  onScore: (score: number) => void;
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

**Variaciones respecto a asteroides:**

- No existe `onLives`: el componente no tiene estado `lives` ni bloque "Vidas" en el HUD.
- `onLevel` se mantiene: el HUD muestra "Nivel".
- Canvas de 800×600, igual que asteroides.

### Estado React del componente (`components/games/vuelco/index.tsx`)

| Estado    | Tipo      | Inicial                                        |
| --------- | --------- | ---------------------------------------------- |
| `score`   | `number`  | `0`                                            |
| `level`   | `number`  | `1`                                            |
| `paused`  | `boolean` | `false`                                        |
| `over`    | `boolean` | `false`                                        |
| `name`    | `string`  | `localStorage.getItem("av_player_name") ?? ""` |
| `saved`   | `boolean` | `false`                                        |
| `gameKey` | `number`  | `0`                                            |

Refs: `canvasRef: useRef<HTMLCanvasElement>(null)`, `controllerRef: useRef<GameController | null>(null)`.

### localStorage keys

| Key                | Contenido                                                              |
| ------------------ | ---------------------------------------------------------------------- |
| `av_player_name`   | Último nombre escrito por el jugador (string, compartido entre juegos) |
| `av_scores_vuelco` | Cache local de scores de VUELCO: array JSON de `{ score, name, at }`   |

### Fila en `references/implemented-games.md`

```markdown
| `vuelco` | VUELCO | ARCADE | green | Invierte la gravedad y corre por el techo. |
```

---

## Plan de implementación

1. **Añadir el cover a `app/globals.css`** — Insertar las reglas `.cover-vuelco` y `.cover-vuelco::after` del Data model tras el último bloque `cover-*`. Verificación: `npm run build` pasa.

2. **Añadir la entrada en `lib/data.ts`** — Insertar el objeto `Game` del Data model al final del array `GAMES`. Verificación: `npm run build` pasa; `/biblioteca` muestra la tarjeta VUELCO con el cover verde; `/juego/vuelco` carga la ficha.

3. **Crear `components/games/vuelco/index.tsx`** — Componente `"use client"` copiando la estructura de `components/games/asteroides/index.tsx` con estos cambios:
   - Nombre del componente: `VuelcoGame`. Props: `{ gameId: string }`.
   - Estado según la tabla del Data model (sin `lives`).
   - `useEffect` dependiente de `gameKey`: `initGame(canvas, { onScore, onLevel, onGameOver })`, guarda el controller en `controllerRef.current`, cleanup `() => controllerRef.current?.destroy()`.
   - `onGameOver`: `setScore(finalScore)` y `setOver(true)`.
   - HUD externo: bloques "Jugador", "Puntuación" y "Nivel" (dos dígitos con `padStart`). Sin bloque "Vidas".
   - Botones PAUSA / FIN / SALIR con las mismas clases que asteroides. El `onClick` de PAUSA y FIN llama además a `e.currentTarget.blur()` para que `Space` no vuelva a activar el botón enfocado.
   - Canvas: `<canvas ref={canvasRef} width={800} height={600} />` dentro de `.crt > .crt-screen` con `tabIndex={0}`.
   - Overlay "EN PAUSA" idéntico al de asteroides.
   - Texto de `.crt-bottom`: `VUELCO · CRT-83 · 60 HZ`.
   - Modal de game over idéntico al de asteroides. "GUARDAR PUNTUACIÓN" ejecuta `void insertScore("vuelco", name, score)`, añade `{ score, name, at: Date.now() }` a `av_scores_vuelco`, guarda `av_player_name` y pone `saved = true`.
   - "JUGAR DE NUEVO": `controller.destroy()`, reinicia `score`, `level`, `paused`, `over`, `saved`, relee `name` de `av_player_name` e incrementa `gameKey`.
   - Verificación: `npm run build` y `npm run lint` pasan.

4. **Crear `app/juego/vuelco/jugar/page.tsx`** — Igual que `app/juego/snake/jugar/page.tsx`, cambiando el import a `@/components/games/vuelco`, el nombre del componente a `VuelcoGame` / `VuelcoJugarPage` y `gameId="vuelco"`. Verificación: `/juego/vuelco/jugar` carga sin errores de SSR ni de consola; el cubo corre y responde a `Space` y al clic.

5. **Registrar en `CANVAS_GAMES`** — En `app/juego/[id]/jugar/page.tsx`, añadir la entrada `vuelco` con el mismo formato que `snake`:

   ```ts
   vuelco: dynamic<{ gameId: string }>(
     () => import("@/components/games/vuelco"),
     { ssr: false },
   ),
   ```

   Verificación: `npm run build` pasa; `/juego/asteroides/jugar` sigue cargando.

6. **Registrar en Supabase** — Ejecutar el INSERT del Data model vía `mcp__supabase__execute_sql`. Verificación: `SELECT slug, name, cat, color, cover FROM games WHERE slug = 'vuelco'` devuelve una fila con `ARCADE`, `green`, `cover-vuelco`.

7. **Actualizar `references/implemented-games.md`** — Añadir la fila del Data model al final de la tabla. Verificación: la tabla tiene 5 filas de juegos.

---

## Criterios de aceptación

- [ ] `lib/data.ts` incluye la entrada `{ id: 'vuelco', cat: 'ARCADE', color: 'green', cover: 'cover-vuelco', ... }` con todos los campos de `Game`
- [ ] `app/globals.css` define `.cover-vuelco` y la tarjeta de `/biblioteca` muestra el cover
- [ ] `components/games/vuelco/index.tsx` renderiza el canvas 800×600 y actualiza Puntuación y Nivel en el HUD durante la partida
- [ ] El HUD no muestra indicador de vidas
- [ ] El botón PAUSA congela el juego y el mismo botón lo reanuda
- [ ] Tras pulsar PAUSA con el ratón, `Space` vuelca la gravedad y no vuelve a pausar
- [ ] `/juego/vuelco/jugar` carga sin errores de SSR ni de consola
- [ ] Al morir aparece el modal con la puntuación final
- [ ] El modal pre-llena el nombre desde `localStorage.getItem('av_player_name')`
- [ ] Al guardar, el score aparece en Supabase: `SELECT * FROM scores WHERE game_slug = 'vuelco'`
- [ ] Al guardar, el nombre se persiste en `av_player_name` y el score en `av_scores_vuelco`
- [ ] El botón "GUARDAR PUNTUACIÓN" desaparece tras el primer guardado y se muestra "PUNTUACIÓN GUARDADA"
- [ ] "JUGAR DE NUEVO" reinicia la partida limpia, con score 0 y nivel 01, sin fuga de listeners ni frames
- [ ] `/salon` muestra tab `VUELCO` y filtra scores del juego
- [ ] `/juego/vuelco` muestra leaderboard lateral con datos de Supabase (o estado vacío si no hay scores)
- [ ] `references/implemented-games.md` contiene la fila de `vuelco`
- [ ] Los juegos ya existentes (asteroides, tetris, arkanoid, snake) siguen funcionando sin cambios
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `npm run lint` pasa sin errores

---

## Decisiones

- **Sí: el tema llega a la ficha.** `short` y `long` describen el vuelco de gravedad como única acción; el cover dibuja el cubo pegado al techo sobre un suelo con hueco.
- **Sí: spec de integración separado del de lógica.** El juego se escribe desde cero y su diseño ocupa un spec entero (GJ-vuelco-01). Separar la integración deja dos cambios revisables por separado. Alternativa descartada: spec combinado como `snake`, que aquí superaría el tamaño razonable.
- **Sí: slug `vuelco`, categoría `ARCADE`.** Runner de reflejos de un botón; no es puzzle, shooter ni versus. `ARCADE` ya existe en `CATS`.
- **Sí: `color: 'green'`.** Recuento en `lib/data.ts`: cyan ×3, magenta ×3, yellow ×3, green ×3. Con empate, se desempata por juegos reales implementados (yellow ×1, cyan ×1, magenta ×2, green ×0): green es el único sin juego real.
- **Sí: cover nuevo `cover-vuelco`.** Ninguna clase existente (`cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`) representa un pasillo con gravedad invertida.
- **Sí: el CSS del cover va en este spec y no en GJ-vuelco-03.** La entrada de `GAMES` referencia la clase; sin ella la tarjeta quedaría vacía tras este spec.
- **Sí: INSERT con todos los campos de catálogo.** Desde SPEC 08 el catálogo de Supabase manda sobre `lib/data.ts`. Insertar solo `slug`, `name`, `active` dejaría `cat`, `color` y `cover` con los valores por defecto de la tabla.
- **Sí: callbacks `onScore`, `onLevel`, `onGameOver`.** Idénticos a GJ-vuelco-01. Sin `onLives` porque el juego tiene una sola vida.
- **Sí: ruta estática `app/juego/vuelco/jugar/page.tsx` además del registro en `CANVAS_GAMES`.** Es lo que hacen `tetris` y `snake`; el mapa cubre la ruta dinámica y la estática evita la espera del catálogo.
- **Sí: `blur()` en los botones del HUD.** `Space` es la tecla principal del juego y también activa el botón enfocado; sin `blur()` un vuelco volvería a pausar.
- **No: guardar metros o racha en Supabase.** `scores.score` basta para ordenar; añadir columnas exige migración sin valor para el leaderboard.
- **No: cambios en `/salon` ni en `/juego/[id]`.** SPEC 06 las diseñó para leer cualquier juego con fila `active` en `games`. Registrar el slug es suficiente para el tab y el leaderboard lateral.

---

## Riesgos

| Riesgo                                                          | Mitigación                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| SSR del canvas y de `localStorage` en el estado inicial         | Dynamic import con `{ ssr: false }` en la ruta estática y en `CANVAS_GAMES`                          |
| Fallo de `insertScore` en Supabase                              | `insertScore` no lanza; el score se guarda igualmente en `av_scores_vuelco`                          |
| Doble guardado del mismo score                                  | Tras guardar, `saved = true` sustituye el botón por el aviso "PUNTUACIÓN GUARDADA"                   |
| Frames o listeners vivos tras desmontar o tras "JUGAR DE NUEVO" | El cleanup del `useEffect` y `restart` llaman a `controller.destroy()`                               |
| `Space` activa el botón PAUSA enfocado                          | `e.currentTarget.blur()` en el `onClick` de PAUSA y FIN                                              |
| El INSERT falla por slug duplicado si se ejecuta dos veces      | `slug` es único; comprobar antes con `SELECT 1 FROM games WHERE slug = 'vuelco'`                     |
| Catálogo de Supabase y `lib/data.ts` divergen                   | Los textos del INSERT y de la entrada `GAMES` son literalmente los mismos en este spec               |
| Turbopack no resuelve la nueva entrada de `CANVAS_GAMES`        | La ruta estática `app/juego/vuelco/jugar/page.tsx` tiene prioridad y carga el componente por sí sola |
