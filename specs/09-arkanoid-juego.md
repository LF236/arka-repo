# SPEC 09 — Arkanoid: Integración del Juego y Leaderboard

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-14
> **Objetivo:** Integrar el juego ARKANOID (canvas vanilla JS con spritesheet y sonidos) en la plataforma Arcade Vault con leaderboard conectado a Supabase, siguiendo el patrón establecido por SPEC 05 y SPEC 06.

---

## Scope

**In:**

- Entrada en `lib/data.ts` con `id: 'arkanoid'`
- `public/games/arkanoid/` — assets copiados desde la referencia (spritesheet + sonidos)
- `components/games/arkanoid/spritesheet.ts` — adaptación de `references/started-games/04-arkanoid/assets/spritesheet.js` a TypeScript con rutas actualizadas a `public/`
- `components/games/arkanoid/game.ts` — adaptación de `game.js` + `levels.js` de la referencia a TypeScript, exponiendo `initGame(canvas, callbacks): GameController`
- `components/games/arkanoid/index.tsx` — componente React con HUD externo, modal de game over/win, guardado de score (Supabase + localStorage), pre-llenado de nombre desde `av_player_name`
- `app/juego/arkanoid/jugar/page.tsx` — ruta de juego con dynamic import del componente con `{ ssr: false }`
- INSERT en Supabase tabla `games`: `{ slug: 'arkanoid', name: 'ARKANOID', active: true }`

**Out of scope:**

- Diseño o modificación de la lógica de juego (proviene de `references/started-games/04-arkanoid/`)
- Autenticación (`user_id` permanece `null`)
- Cambios en `app/salon/page.tsx` o `app/juego/[id]/page.tsx` (ya manejan cualquier juego real de Supabase sin modificación)
- Paginación del leaderboard
- Moderación de scores
- Controles táctiles / gamepad
- Eliminar o modificar la entrada mock `bloque-buster` de `lib/data.ts`

---

## Data model

### Nueva entrada en `GAMES` (`lib/data.ts`)

```ts
{
  id: 'arkanoid',
  title: 'ARKANOID',
  short: 'Rompe todos los bloques antes de perder tus 3 vidas.',
  long: 'Mueve la paleta con el ratón o las flechas y rebota el núcleo de plasma para destruir cinco niveles de bloques cromados. Cada nivel reorganiza los patrones y acelera la bola. Con solo tres vidas y el techo cada vez más cerca, ¿puedes llegar al último nivel y completar el Arkanoid?',
  cat: 'ARCADE',
  cover: 'cover-bricks',  // reusar clase CSS del mock bloque-buster
  color: 'magenta',
  best: 0,
  plays: '0',
}
```

### Interfaz del módulo de juego

```ts
// components/games/arkanoid/game.ts

export interface GameCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // se dispara en 'gameover' Y en 'win'
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

Callbacks idénticos a Asteroides. El estado `'win'` del juego original (completar los 5 niveles) invoca `onGameOver(finalScore)` — igual que `'gameover'`. El componente muestra el mismo modal de guardado en ambos casos.

### SQL INSERT

```sql
INSERT INTO games (slug, name, active) VALUES ('arkanoid', 'ARKANOID', true);
```

### localStorage keys

| Key                  | Contenido                                      |
| -------------------- | ---------------------------------------------- |
| `av_player_name`     | Último nombre escrito por el jugador (string)  |
| `av_scores_arkanoid` | Cache local de scores de Arkanoid (array JSON) |

---

## Plan de implementación

1. **Copiar assets a `public/`** — Copiar desde `references/started-games/04-arkanoid/assets/` a `public/games/arkanoid/`: el archivo `spritesheet-breakout.png` y la carpeta `sounds/` (con `ball-bounce.mp3` y `break-sound.mp3`). Verificación: los archivos son accesibles en las rutas `/games/arkanoid/spritesheet-breakout.png` y `/games/arkanoid/sounds/ball-bounce.mp3`.

2. **Añadir entrada en `lib/data.ts`** — Insertar el objeto `Game` con `id: 'arkanoid'` en el array `GAMES`. Verificación: `npm run build` compila sin errores; `/juego/arkanoid` carga la ficha con título "ARKANOID".

3. **Crear `components/games/arkanoid/spritesheet.ts`** — Adaptar `references/started-games/04-arkanoid/assets/spritesheet.js` a TypeScript. Actualizar la ruta de imagen a `/games/arkanoid/spritesheet-breakout.png`. Exportar `loadSpritesheet`, `drawSprite`, `drawFrame`, `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`. Verificación: TypeScript compila sin errores de tipos.

4. **Crear `components/games/arkanoid/game.ts`** — Adaptar `references/started-games/04-arkanoid/game.js` y `levels.js` a un único módulo TypeScript. Cambios respecto al original:
   - Eliminar `document.getElementById('canvas')` — el canvas se recibe por parámetro en `initGame`.
   - Importar `LEVELS` directamente en el módulo (no como global de script).
   - Importar helpers de `spritesheet.ts`.
   - Registrar listeners de mouse (`mousemove` sobre `canvas`) y teclado (`keydown`/`keyup`) dentro de `initGame`; limpiarlos en `destroy()` con la misma referencia de función.
   - Actualizar rutas de sonidos a `/games/arkanoid/sounds/`.
   - Invocar callbacks en los momentos correctos:
     - `onScore(score)` — cada vez que `score` cambia (tras destruir un bloque).
     - `onLives(lives)` — cada vez que `lives` cambia (tras perder una vida).
     - `onLevel(level + 1)` — al pasar de nivel (en la función de avance de nivel).
     - `onGameOver(finalScore)` — cuando `gameState` pasa a `'gameover'` o a `'win'`.
   - Pausa: variable interna `let paused = false` con `pause()` y `resume()` que el game loop chequea cada frame.
   - `initGame` retorna `{ pause, resume, destroy }`.
   - Verificación: TypeScript compila sin errores; el juego responde a mouse y flechas en canvas.

5. **Crear `components/games/arkanoid/index.tsx`** — Componente `'use client'` siguiendo el patrón de `components/games/asteroides/index.tsx`:
   - Props: `{ gameId: string }`.
   - Estado: `score`, `lives` (init 3), `level` (init 1), `paused`, `over`, `name`, `saved`.
   - `canvasRef` y `controllerRef`.
   - `useEffect` que llama `initGame(canvas, callbacks)`, guarda el controller en `controllerRef.current`, retorna `() => controllerRef.current?.destroy()`.
   - HUD externo con nombre, score, vidas (♥), nivel, botones PAUSA/FIN/SALIR.
   - Modal de game over (mismo para `'gameover'` y `'win'`): input de nombre pre-llenado desde `localStorage.getItem('av_player_name')`, botón "GUARDAR PUNTUACIÓN" (llama `insertScore('arkanoid', name, score)` + actualiza cache `av_scores_arkanoid` + persiste `av_player_name`), botón "JUGAR DE NUEVO".
   - Canvas con `tabIndex={0}` en su wrapper para mantener foco de teclado.
   - Verificación: el componente renderiza sin errores; HUD se actualiza en tiempo real.

6. **Crear `app/juego/arkanoid/jugar/page.tsx`** — Dynamic import del componente con `{ ssr: false }`, igual que `app/juego/asteroides/jugar/page.tsx`. Verificación: `/juego/arkanoid/jugar` carga sin errores de SSR ni de consola.

7. **Registrar en Supabase** — Ejecutar el INSERT en la tabla `games` via `mcp__supabase__execute_sql`. Verificación: `SELECT * FROM games WHERE slug = 'arkanoid'` devuelve la fila.

8. **Verificar integración completa** — `npm run build` y `npm run lint` pasan; `/juego/arkanoid/jugar` carga y el juego responde a mouse y flechas; al terminar (gameover o win) aparece el modal de puntuación; el score aparece en Supabase y en `av_scores_arkanoid`; `/salon` muestra tab ARKANOID; `/juego/arkanoid` muestra leaderboard lateral; los juegos existentes (asteroides, tetris) no se rompen.

---

## Criterios de aceptación

- [X] `lib/data.ts` incluye la entrada `{ id: 'arkanoid', color: 'magenta', cat: 'ARCADE', ... }` con todos los campos
- [X] `public/games/arkanoid/spritesheet-breakout.png` y `public/games/arkanoid/sounds/` existen y son accesibles
- [X] `components/games/arkanoid/game.ts` exporta `initGame` con la firma `GameController`
- [X] `components/games/arkanoid/index.tsx` renderiza el canvas y actualiza el HUD sin errores
- [X] `/juego/arkanoid/jugar` carga sin errores de SSR ni de consola
- [X] El juego responde al movimiento del ratón y a las flechas ← →
- [X] Al terminar una partida (gameover o win), el modal de puntuación aparece
- [X] El modal pre-llena el nombre desde `localStorage.getItem('av_player_name')`
- [X] Al guardar, el score aparece en Supabase: `SELECT * FROM scores WHERE game_slug = 'arkanoid'`
- [X] Al guardar, el nombre se persiste en `av_player_name` y el score en `av_scores_arkanoid`
- [X] El botón "GUARDAR PUNTUACIÓN" se deshabilita tras el primer guardado exitoso
- [X] `/salon` muestra tab ARKANOID y filtra scores del juego
- [X] `/juego/arkanoid` muestra leaderboard lateral con datos de Supabase (o estado vacío si no hay scores)
- [X] Los juegos ya existentes (asteroides, tetris, etc.) siguen funcionando sin cambios
- [X] `npm run build` completa sin errores TypeScript
- [X] `npm run lint` pasa sin errores

---

## Decisiones

- **Spec combinado (juego + leaderboard):** el patrón es repetible y predecible; separarlo en dos specs solo añade fricción sin beneficio trazable.
- **`app/salon` y `app/juego/[id]/page.tsx` sin cambios:** SPEC 06 diseñó estas páginas para consumir cualquier juego activo en Supabase. Registrar el slug en la tabla `games` es suficiente para que aparezca en tabs y leaderboard lateral.
- **`onGameOver` para 'win' y 'gameover':** simplifica el componente; el jugador guarda su score en ambos casos. No hay distinción visual entre ganar y perder salvo el score final.
- **Sin bonus por vidas restantes:** el score es exactamente los puntos de bloques destruidos. Coherente con el diseño del juego de referencia.
- **`cover-bricks` reutilizado:** la clase CSS ya existe para `bloque-buster`. La ruta `cover-arkanoid` requeriría crear un nuevo asset visual; se pospone a un spec futuro de mejora visual.
- **`magenta` como color neon:** el menos usado en `lib/data.ts` al momento de escribir este spec (cyan×3, yellow×3, green×3, magenta×1).
- **Dos archivos JS → un módulo TypeScript:** `game.js` y `levels.js` se funden en `game.ts` para evitar la coordinación de módulos ES en tiempo de bundle. `spritesheet.ts` se mantiene separado por su tamaño y responsabilidad de carga de imagen.
- **Assets en `public/games/arkanoid/`:** Next.js sirve archivos de `public/` con rutas absolutas. Es la forma estándar de incluir assets binarios (imágenes, audio) accesibles desde el navegador.

---

## Riesgos

| Riesgo                                                       | Mitigación                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| SSR del canvas (`window`/`document` undefined en servidor)   | Dynamic import con `{ ssr: false }` en la página de juego                                                                          |
| `new Image()` en `spritesheet.ts` falla en SSR               | Idéntico al canvas: el módulo solo se ejecuta en cliente gracias a `{ ssr: false }`                                                |
| Rutas de assets incorrectas tras mover a `public/`           | Usar rutas absolutas `/games/arkanoid/...`; verificar con `npm run build` y un navegador                                           |
| Listeners de mouse no limpiados al desmontar                 | `destroy()` llama `removeEventListener` con la misma referencia; el cleanup del useEffect lo invoca incluso en desmonte anticipado |
| Fallo de `insertScore` en Supabase                           | Error silencioso (`console.error`); el score se guarda igualmente en `av_scores_arkanoid`                                          |
| Doble guardado si el usuario presiona "GUARDAR" varias veces | Deshabilitar el botón tras el primer click exitoso (estado `saved = true`)                                                         |
