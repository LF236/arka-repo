# SPEC 10 — Snake: Integración del Juego y Leaderboard

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-14
> **Objetivo:** Integrar el juego Snake (canvas vanilla JS, 800×800, grid 32×32) en la plataforma Arcade Vault con leaderboard conectado a Supabase, usando frutas del sprite atlas como alimento.

---

## Scope

**In:**

- `public/snake/fruits.png` — copia del asset de referencia para acceso en runtime
- `lib/data.ts` — nueva entrada con `id: 'snake'` en el array `GAMES`
- `components/games/snake/game.ts` — lógica del juego escrita desde cero en TypeScript, exponiendo `initGame(canvas, callbacks): GameController`
- `components/games/snake/index.tsx` — componente React con HUD, modal de game over, guardado de score (Supabase + localStorage), pre-llenado de nombre desde `av_player_name`
- `app/juego/snake/jugar/page.tsx` — ruta de juego con dynamic import del componente
- INSERT en Supabase tabla `games`: `{ slug: 'snake', name: 'SNAKE', active: true }`

**Out of scope:**

- Modificar la entrada mock `serpentina` en `lib/data.ts` (permanece inalterada)
- Controles táctiles / gamepad
- Efectos de sonido
- Animación de muerte de la serpiente
- Autenticación (`user_id` permanece `null`)
- Cambios en `app/salon/page.tsx` o `app/juego/[id]/page.tsx` (ya manejan cualquier juego real de Supabase sin modificación)
- Paginación del leaderboard
- Moderación de scores

---

## Data model

### Nueva entrada en `GAMES` (`lib/data.ts`)

```ts
{
  id: 'snake',
  title: 'SNAKE',
  short: 'Come frutas, crece y no toques las paredes.',
  long: 'Una serpiente de píxeles recorre una cuadrícula de 32×32 celdas coleccionando frutas del atlas. Cada bocado la alarga y acelera su ritmo. Las paredes son letales y morder tu propia cola significa el fin. ¿Cuántas frutas aguantas antes de que la velocidad te supere?',
  cat: 'ARCADE',
  cover: 'cover-snake',
  color: 'magenta',
  best: 0,
  plays: '0',
}
```

### SQL de INSERT en Supabase

```sql
INSERT INTO games (slug, name, active) VALUES ('snake', 'SNAKE', true);
```

### Interfaz del módulo de juego

```ts
// components/games/snake/game.ts

export interface GameCallbacks {
  onScore: (score: number) => void;
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

**Variación respecto al patrón asteroides:** Snake no tiene vidas ni niveles, por lo que `onLives` y `onLevel` no existen en este juego. El componente no muestra indicadores de vidas ni nivel en el HUD.

### Lógica de juego (`game.ts`)

Constantes y estado interno (no exportados):

```ts
const CELL = 25; // px por celda
const COLS = 32; // 800 / 25
const ROWS = 32; // 800 / 25
const INITIAL_INTERVAL = 150; // ms entre pasos
const SPEED_STEP = 5; // frutas para acelerar
const SPEED_FACTOR = 0.95; // multiplicador de intervalo en cada escalón
const MIN_INTERVAL = 50; // cap mínimo de velocidad
const POINTS_PER_FRUIT = 10;

// Tipos de fruta del sprite atlas (clave de SPRITE_ATLAS.fruits)
const FRUIT_TYPES = [
  "banana",
  "orange",
  "grape",
  "garlic",
  "eggplant",
  "strawberry",
  "cherry",
  "carrot",
  "mushroom",
  "broccoli",
  "watermelon",
  "pepper",
  "kiwi",
  "lemon",
  "peach",
  "peanut",
  "apple",
  "tomato",
  "berries",
  "grapes2",
  "pineapple",
  "melon",
];

// Estado mutable en initGame
let snake: Array<{ x: number; y: number }>; // head first
let dir: { dx: number; dy: number };
let nextDir: { dx: number; dy: number };
let food: { x: number; y: number; type: string };
let score: number;
let fruitsEaten: number;
let interval: number;
let paused: boolean;
let gameOver: boolean;
let timerId: ReturnType<typeof setInterval> | null;
```

Algoritmo de movimiento (ejecutado por `setInterval` a `interval` ms):

1. Aplicar `nextDir` → `dir` (bloqueando reversas directas: si `nextDir.dx === -dir.dx` ignorar).
2. Calcular nueva cabeza: `{x: head.x + dir.dx, y: head.y + dir.dy}`.
3. Si colisiona con pared (`x < 0 || x >= COLS || y < 0 || y >= ROWS`) → `gameOver`, llamar `callbacks.onGameOver(score)`.
4. Si colisiona con cuerpo propio → mismo resultado.
5. Si nueva cabeza coincide con `food`:
   - No quitar cola (serpiente crece).
   - `score += POINTS_PER_FRUIT`; `fruitsEaten++`.
   - Llamar `callbacks.onScore(score)`.
   - Si `fruitsEaten % SPEED_STEP === 0`: reducir `interval = Math.max(MIN_INTERVAL, interval * SPEED_FACTOR)`, reiniciar timer.
   - Generar nueva `food` en posición libre aleatoria con tipo aleatorio de `FRUIT_TYPES`.
6. Si no hay comida: quitar último elemento de `snake` (cola se mueve).
7. Añadir nueva cabeza al inicio de `snake`.
8. Redibujar canvas.

Renderizado:

- Fondo negro (`#000`).
- Borde de pared: línea de 2px en `#ff00ff` (magenta neon) rodeando el área de juego.
- Cuerpo de serpiente: rectángulos `#00ff88` con borde `#004422`, celda de `CELL×CELL`.
- Cabeza: mismo color pero con ligero brillo o borde más grueso.
- Comida: `ctx.drawImage(fruitsImg, sprite.x, sprite.y, sprite.w, sprite.h, cellX, cellY, CELL, CELL)`.
- HUD interno mínimo: score en esquina superior izquierda (texto pequeño `#aaa`).

La imagen `fruits.png` se carga una vez con `new Image()` antes de iniciar el loop; el primer fotograma empieza cuando `fruitsImg.onload` dispara.

### localStorage keys

| Key               | Contenido                                                   |
| ----------------- | ----------------------------------------------------------- |
| `av_player_name`  | Último nombre escrito por el jugador (string)               |
| `av_scores_snake` | Cache local de scores de Snake (array JSON — mismo formato) |

---

## Plan de implementación

1. **Copiar asset de fruta a `public/`** — Copiar `references/source-assets/snake-assets/fruits.png` a `public/snake/fruits.png`. Verificación: `GET /snake/fruits.png` devuelve la imagen en el servidor de desarrollo.

2. **Añadir entrada en `lib/data.ts`** — Insertar el objeto `Game` del Data model en el array `GAMES`. El ID debe ser exactamente `'snake'`; la entrada mock `'serpentina'` no se modifica. Verificación: `npm run build` compila sin errores.

3. **Crear `components/games/snake/game.ts`** — Implementar la lógica de Snake desde cero siguiendo el Data model de esta sección:
   - `initGame(canvas, callbacks)`: inicializa estado, carga `fruits.png` desde `/snake/fruits.png`, registra `keydown` listeners para flechas y WASD, arranca el loop con `setInterval`, retorna `{ pause, resume, destroy }`.
   - `pause()` / `resume()`: activan `paused`; el loop salta la actualización pero no el render (canvas congela su último frame).
   - `destroy()`: llama `clearInterval(timerId)`, elimina los listeners de teclado.
   - `nextDir` acepta cambios de dirección durante pausa (se aplican al reanudar).
   - Verificación: TypeScript compila sin errores; `npm run lint` pasa.

4. **Crear `components/games/snake/index.tsx`** — Componente `'use client'` siguiendo el patrón de `components/games/asteroides/index.tsx`:
   - Props: `{ gameId: string }`.
   - Estado React: `score` (init 0), `paused` (init false), `over` (init false), `name` (init `''`), `saved` (init false).
   - `canvasRef`: `useRef<HTMLCanvasElement>(null)`.
   - `controllerRef`: `useRef<GameController | null>(null)`.
   - `useEffect` (monta/desmonta): llama `initGame(canvas, { onScore, onGameOver })`, guarda controller en `controllerRef.current`, retorna cleanup `() => controllerRef.current?.destroy()`.
   - `onGameOver`: llama `setOver(true)`, pre-llena `name` desde `localStorage.getItem('av_player_name') ?? ''`.
   - Botón PAUSA: alterna `paused`, llama `controller.pause()` / `controller.resume()`.
   - Modal de game over: input de nombre, botón "GUARDAR PUNTUACIÓN" (llama `insertScore` + cache `av_scores_snake` + persiste `av_player_name`), botón "JUGAR DE NUEVO" (destruye y reinicia el juego incrementando key del canvas).
   - HUD externo: score formateado, botones PAUSA / FIN / SALIR. Sin indicadores de vidas ni nivel.
   - Canvas: `<canvas ref={canvasRef} width={800} height={800} />` dentro del wrapper CRT existente.
   - Verificación: el componente renderiza sin errores; el canvas aparece y responde a flechas y WASD.

5. **Crear `app/juego/snake/jugar/page.tsx`** — Dynamic import del componente con `{ ssr: false }`, igual que `app/juego/arkanoid/jugar/page.tsx`. Añadir la entrada `snake` al mapa estático `CANVAS_GAMES` en `app/juego/[id]/jugar/page.tsx`. Verificación: `/juego/snake/jugar` carga sin errores de SSR ni de consola.

6. **Registrar en Supabase** — Ejecutar el INSERT de la tabla `games` via `mcp__supabase__execute_sql`. Verificación: `SELECT * FROM games WHERE slug = 'snake'` devuelve la fila.

7. **Verificar integración completa** — `npm run build` y `npm run lint` pasan sin errores; `/juego/snake/jugar` carga y el juego responde; al terminar una partida el score aparece en Supabase; `/salon` muestra tab `SNAKE`; `/juego/snake` muestra leaderboard lateral; los juegos existentes (asteroides, arkanoid, tetris) no se rompen.

---

## Criterios de aceptación

- [ ] `public/snake/fruits.png` existe y es accesible en runtime
- [ ] `lib/data.ts` incluye la entrada `{ id: 'snake', color: 'magenta', ... }` con todos los campos
- [ ] La entrada mock `serpentina` permanece inalterada en `lib/data.ts`
- [ ] `components/games/snake/game.ts` exporta `initGame` con la firma `GameController`
- [ ] La serpiente se mueve a ritmo de `setInterval` (no `requestAnimationFrame`)
- [ ] Colisión con pared → game over (las paredes matan)
- [ ] Colisión con cuerpo propio → game over
- [ ] La fruta se muestra como sprite del atlas (`fruits.png`), tipo aleatorio en cada spawn
- [ ] Score aumenta +10 por fruta; la velocidad aumenta cada 5 frutas hasta el cap de 50 ms
- [ ] `components/games/snake/index.tsx` renderiza el canvas 800×800 y actualiza el HUD sin errores
- [ ] `/juego/snake/jugar` carga sin errores de SSR ni de consola
- [ ] Al terminar una partida, el score aparece en Supabase: `SELECT * FROM scores WHERE game_slug = 'snake'`
- [ ] El modal pre-llena el nombre desde `localStorage.getItem('av_player_name')`
- [ ] Al guardar, el nombre se persiste en `av_player_name` y el score en `av_scores_snake`
- [ ] "JUGAR DE NUEVO" reinicia el juego limpio sin fuga de timers ni listeners
- [ ] `/salon` muestra tab `SNAKE` y filtra scores del juego
- [ ] `/juego/snake` muestra leaderboard lateral con datos de Supabase (o estado vacío si no hay scores)
- [ ] Los juegos ya existentes (asteroides, arkanoid, tetris) siguen funcionando sin cambios
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `npm run lint` pasa sin errores

---

## Decisiones

- **Sí: spec combinado (juego + leaderboard)** — Snake no introduce cambios en la infraestructura de Supabase ni en las páginas `/salon` o `/juego/[id]`. Todo el trabajo es añadir el componente de juego y registrar el slug. Un spec combinado refleja ese alcance acotado y es ejecutable en un solo ciclo de `/spec-impl`.
- **Sí: `setInterval` en lugar de `requestAnimationFrame`** — Snake es un juego de pasos discretos (el movimiento ocurre cada N ms, no por frame). `setInterval` modela ese tick natural y hace trivial ajustar la velocidad sin recalcular deltas de tiempo. `rAF` añadiría complejidad sin beneficio para este estilo de juego.
- **Sí: slug `snake`, entrada `serpentina` intacta** — El usuario confirmó slug nuevo. La entrada mock `serpentina` permanece como placeholder en el catálogo; no se toca ni se elimina.
- **Sí: `color: 'magenta'`** — Es el color menos usado en `lib/data.ts` (2 juegos vs 3 de cyan, yellow y green). Snake clásico suele ser verde, pero `serpentina` ya ocupa ese nicho visual; magenta diferencia la entrada.
- **Sí: frutas del sprite atlas como alimento** — El asset ya está disponible en `references/source-assets/snake-assets/`. Aporta variedad visual sin coste de diseño adicional.
- **Sí: `cover-snake` para la tarjeta** — La clase CSS ya existe (la usa `serpentina`). Ambos son juegos de serpiente; reutilizar el cover es coherente.
- **No: `onLives` / `onLevel` callbacks** — Snake es un juego de vida única sin niveles explícitos. Los callbacks se omiten; el HUD no muestra esos indicadores. La aceleración progresiva sustituye funcionalmente al incremento de nivel.
- **No: colores distintos por tipo de fruta en el score** — El usuario confirmó puntuación fija (+10). El valor diferencial de los sprites es visual, no mecánico.
- **Sí: páginas `/salon` y `/juego/[id]/page.tsx` sin modificaciones** — El diseño genérico del SPEC 06 ya maneja cualquier juego activo en Supabase. Solo se registra el slug.

---

## Riesgos

| Riesgo                                                        | Mitigación                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SSR del canvas (`window`/`document` undefined en servidor)    | Dynamic import con `{ ssr: false }` en la página de juego                                             |
| `fruits.png` no encontrada en runtime (ruta incorrecta)       | Cargar desde `/snake/fruits.png` (carpeta pública estática); verificar en paso 1 antes de continuar   |
| Fallo de `insertScore` en Supabase                            | Error silencioso (`console.error`); el score se guarda igualmente en `av_scores_snake`                |
| Timer activo tras desmontar el componente                     | `destroy()` llama `clearInterval(timerId)` en el cleanup del `useEffect`                              |
| `nextDir` procesado en mid-tick produce movimiento inesperado | `nextDir` solo se aplica al inicio del tick, bloqueando la reversa directa (`nextDir.dx === -dir.dx`) |
