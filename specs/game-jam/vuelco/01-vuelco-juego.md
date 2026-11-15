# SPEC GJ-vuelco-01 — VUELCO: Diseño y Lógica del Juego

> **Status:** Borrador
> **Depends on:** SPEC 05
> **Date:** 2026-11-14
> **Tema del jam:** gravedad invertida
> **Objetivo:** Escribir desde cero `components/games/vuelco/game.ts`, un runner de pasillo en canvas 800×600 donde la única acción del jugador es invertir la gravedad para correr por el suelo o por el techo.

---

## Scope

**In:**

- `components/games/vuelco/game.ts` — lógica completa del juego en TypeScript vanilla (sin React), escrita desde cero. Exporta `GameCallbacks`, `GameController` e `initGame(canvas, callbacks): GameController`.
- Mecánica de inversión de gravedad, generación procedural del pasillo, colisiones, puntuación, niveles de velocidad y renderizado con formas primitivas.

**Out of scope:**

- `components/games/vuelco/index.tsx`, `lib/data.ts`, `app/juego/vuelco/jugar/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `app/globals.css`, INSERT en Supabase, `references/implemented-games.md` → GJ-vuelco-02
- Pantalla de inicio, partículas, estela, sacudida de pantalla, fondo con parallax, textos flotantes → GJ-vuelco-03
- Efectos de sonido
- Controles táctiles / gamepad
- Assets externos (imágenes, fuentes, audio): todo se dibuja con primitivas de canvas
- Vidas múltiples, power-ups, jefes, niveles diseñados a mano

---

## Data model

### Concepto

Un cubo corre solo por un pasillo horizontal infinito con suelo y techo. El jugador no salta: **vuelca la gravedad**. Al volcar, el cubo cae hacia la superficie opuesta y sigue corriendo por ella. El pasillo tiene huecos (el cubo cae al vacío), púas (matan al contacto) y barreras centrales (matan si se cruza el pasillo en ese punto). Una sola vida.

### Interfaz del módulo

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

**Variación respecto a asteroides:** no existe `onLives` (una sola vida). `onLevel` sí existe.

### Canvas y coordenadas

- Canvas de 800×600 px (atributos `width`/`height` fijados por el componente).
- Origen arriba-izquierda. Velocidades en px/s. Tiempos en segundos.
- El mundo se mide en px de "distancia recorrida". `screenX = worldX - distance`.

### Controles

| Entrada                                         | Acción             |
| ----------------------------------------------- | ------------------ |
| `Space`, `ArrowUp`, `ArrowDown`, `KeyW`, `KeyS` | Volcar la gravedad |
| `mousedown` sobre el canvas                     | Volcar la gravedad |

- Los `keydown` se registran en `window`; el `mousedown` en el `canvas`.
- `preventDefault()` en `Space`, `ArrowUp` y `ArrowDown` para que la página no haga scroll.
- Se ignora `e.repeat` (mantener pulsado no vuelca en bucle).
- No hay movimiento horizontal ni otras acciones.

### Constantes

```ts
const W = 800;
const H = 600;

// Pasillo
const CEIL_Y = 80; // borde inferior del techo
const FLOOR_Y = 520; // borde superior del suelo

// Jugador
const PLAYER_X = 160; // borde izquierdo del cubo en pantalla (fijo)
const PLAYER_SIZE = 28;
const HITBOX_INSET = 4; // el AABB letal se encoge 4 px por lado

// Física
const GRAVITY = 2600; // px/s²
const FLIP_IMPULSE = 300; // px/s inicial hacia la nueva gravedad
const MAX_FALL = 1600; // px/s, tope de seguridad
const FLIGHT_TIME = 0.46; // s que tarda un vuelco completo suelo↔techo
const FLIP_BUFFER = 0.12; // s que se recuerda una pulsación hecha en el aire
const COYOTE = 0.08; // s en que aún se puede volcar tras perder la superficie
const OUT_MARGIN = 60; // px fuera del canvas a partir de los cuales se muere

// Velocidad y niveles
const SPEED_START = 260; // px/s
const SPEED_STEP = 30; // px/s por nivel
const SPEED_MAX = 620; // px/s (se alcanza en el nivel 13)
const LEVEL_DISTANCE = 2400; // px recorridos por nivel

// Generación del pasillo
const START_SAFE = 900; // px iniciales sin peligros
const SAFE_MARGIN = 90; // px extra sobre la distancia de vuelo
const SAFE_EXTRA_MAX = 220; // px aleatorios extra en tramos seguros
const HAZARD_STEP = 24; // los anchos de peligro son múltiplos de 24
const HAZARD_MIN = 120;
const HAZARD_MAX = 240;
const SPIKE_W = 24;
const SPIKE_H = 24;
const BARRIER_W = 36;
const BARRIER_H = 120; // centrada en y = 300 → ocupa y ∈ [240, 360]
const BARRIER_MIN_LEVEL = 3;

// Chispas
const SPARK_R = 8;
const SPARK_EDGE_OFFSET = 30; // px desde la superficie para chispas de borde
const SPARK_MID_CHANCE = 0.7;
const SPARK_EDGE_CHANCE = 0.5;

// Puntuación
const PX_PER_METER = 40;
const POINTS_PER_METER = 1;
const POINTS_PER_SPARK = 50;
const MAX_STREAK = 5;
```

### Tipos y estado mutable

```ts
type Side = "floor" | "ceil";
type HazardKind = "none" | "gap" | "spikes" | "barrier";

interface Segment {
  x: number; // worldX del borde izquierdo
  w: number;
  kind: HazardKind; // "none" = tramo seguro
  side: Side | null; // lado afectado por "gap" / "spikes"; null en "none" y "barrier"
}

interface Spark {
  x: number; // worldX del centro
  y: number;
  taken: boolean;
}

// Estado (se reinicia entero dentro de initGame)
let ctx: CanvasRenderingContext2D;
let segments: Segment[];
let sparks: Spark[];
let playerY: number; // borde superior del cubo
let vy: number;
let gDir: 1 | -1; // 1 = gravedad hacia el suelo, -1 = hacia el techo
let grounded: boolean;
let coyoteTimer: number;
let bufferTimer: number;
let distance: number; // px recorridos
let speed: number;
let level: number;
let sparkPoints: number;
let streak: number;
let score: number;
let expectedSide: Side; // lado en el que el generador supone al jugador
let genX: number; // worldX hasta donde hay pasillo generado
let state: "playing" | "gameover";
let paused: boolean;
let rafHandle: number;
let lastTime: number | null;
```

Valores iniciales: `playerY = FLOOR_Y - PLAYER_SIZE` (492), `vy = 0`, `gDir = 1`, `grounded = true`, `distance = 0`, `speed = SPEED_START`, `level = 1`, `sparkPoints = 0`, `streak = 0`, `score = 0`, `expectedSide = "floor"`, `state = "playing"`, `paused = false`, `lastTime = null`. `segments` empieza con un único tramo `{ x: 0, w: START_SAFE, kind: "none", side: null }` y `genX = START_SAFE`.

### Generación del pasillo

El generador añade tramos mientras `genX < distance + W + 400`. Siempre añade una **pareja** `[tramo seguro, peligro]`:

1. Elegir `kind` del peligro:
   - `level < BARRIER_MIN_LEVEL`: `gap` 70 %, `spikes` 30 %.
   - `level >= BARRIER_MIN_LEVEL`: `gap` 50 %, `spikes` 30 %, `barrier` 20 %.
2. Elegir `side` al azar (50/50) para `gap` y `spikes`; `null` para `barrier`.
3. Ancho del peligro: `barrier` → `BARRIER_W`. `gap` / `spikes` → múltiplo aleatorio de `HAZARD_STEP` en `[HAZARD_MIN, HAZARD_MAX]`.
4. Ancho del tramo seguro previo: `Math.round(speed * FLIGHT_TIME) + SAFE_MARGIN + rand(0, SAFE_EXTRA_MAX)`. Garantiza espacio para un vuelco completo a la velocidad actual.
5. Chispa central: si `side === expectedSide` (el vuelco es obligatorio) y `Math.random() < SPARK_MID_CHANCE`, añadir chispa en el centro horizontal del tramo seguro, `y = 300`.
6. Chispa de borde: si `kind` es `gap` o `spikes` y `Math.random() < SPARK_EDGE_CHANCE`, añadir chispa en el centro horizontal del peligro, pegada al lado **opuesto** al peligro: `y = CEIL_Y + SPARK_EDGE_OFFSET` (110) si el peligro está en el suelo, `y = FLOOR_Y - SPARK_EDGE_OFFSET` (490) si está en el techo.
7. Si `side !== null`: `expectedSide = lado opuesto a side`.
8. Empujar ambos tramos a `segments` y avanzar `genX`.

Reglas derivadas: nunca hay dos peligros seguidos; nunca falta suelo y techo a la vez; un tramo `barrier` tiene suelo y techo sólidos.

Limpieza: se eliminan tramos con `x + w < distance - 100` y chispas con `x < distance - 100`.

### Solidez de las superficies

Un lado `S` es sólido en un tramo salvo que `kind === "gap" && side === S`. Para el cubo se consultan los tramos que solapan su rango horizontal en mundo: `[distance + PLAYER_X, distance + PLAYER_X + PLAYER_SIZE]`. Hay apoyo si **algún** tramo solapado es sólido en ese lado.

### Algoritmo del tick (`update(dt)`, con `state === "playing"`)

1. **Temporizadores:** restar `dt` a `coyoteTimer` y `bufferTimer` (mínimo 0).
2. **Entrada:** una pulsación pone `bufferTimer = FLIP_BUFFER`. Si `bufferTimer > 0` y (`grounded` o `coyoteTimer > 0`): `gDir = -gDir`, `vy = gDir * FLIP_IMPULSE`, `grounded = false`, `coyoteTimer = 0`, `bufferTimer = 0`.
3. **Física vertical:** guardar siempre `prevY = playerY`. Si no está `grounded`: `vy += gDir * GRAVITY * dt`, limitar a `±MAX_FALL`, `playerY += vy * dt`.
4. **Avance:** `distance += speed * dt`.
5. **Apoyo:**
   - `gDir === 1`: si hay apoyo en `floor`, `playerY + PLAYER_SIZE >= FLOOR_Y` y `prevY + PLAYER_SIZE <= FLOOR_Y + 1` → `playerY = FLOOR_Y - PLAYER_SIZE`, `vy = 0`, `grounded = true`.
   - `gDir === -1`: si hay apoyo en `ceil`, `playerY <= CEIL_Y` y `prevY >= CEIL_Y - 1` → `playerY = CEIL_Y`, `vy = 0`, `grounded = true`.
   - Si estaba `grounded` y ya no hay apoyo en su lado: `grounded = false`, `coyoteTimer = COYOTE`.
   - La condición sobre `prevY` impide que un cubo que ya cae dentro de un hueco se "enganche" al borde siguiente.
6. **Muerte por vacío:** `playerY > H + OUT_MARGIN` o `playerY + PLAYER_SIZE < -OUT_MARGIN` → morir.
7. **Muerte por púas y barreras:** AABB del cubo encogido `HITBOX_INSET` por lado contra:
   - `spikes` en `floor`: rectángulo `x ∈ [seg.x, seg.x + seg.w]`, `y ∈ [FLOOR_Y - SPIKE_H, FLOOR_Y]`.
   - `spikes` en `ceil`: `y ∈ [CEIL_Y, CEIL_Y + SPIKE_H]`.
   - `barrier`: `x ∈ [seg.x, seg.x + BARRIER_W]`, `y ∈ [240, 360]`.
   - Cualquier solape → morir.
8. **Chispas:** para cada chispa no tomada, si el círculo (radio `SPARK_R`) solapa el AABB completo del cubo: `taken = true`, `streak += 1`, `sparkPoints += POINTS_PER_SPARK * Math.min(streak, MAX_STREAK)`. Si una chispa no tomada cumple `x + SPARK_R < distance` (sale por la izquierda): `streak = 0` y se marca `taken = true` para no volver a evaluarla.
9. **Puntuación:** `nuevo = Math.floor(distance / PX_PER_METER) * POINTS_PER_METER + sparkPoints`. Si `nuevo !== score`: `score = nuevo`, `callbacks.onScore(score)`.
10. **Nivel:** `nuevoNivel = 1 + Math.floor(distance / LEVEL_DISTANCE)`. Si cambia: `level = nuevoNivel`, `speed = Math.min(SPEED_MAX, SPEED_START + (level - 1) * SPEED_STEP)`, `callbacks.onLevel(level)`.
11. **Generación y limpieza** del pasillo.

**Morir:** `state = "gameover"`, `callbacks.onGameOver(score)`. Se invoca una sola vez. En `gameover` el `update` no hace nada; el `draw` sigue pintando el último estado.

### Loop

- `requestAnimationFrame`. `dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05)`.
- Si `paused`: no se actualiza ni se dibuja, se pone `lastTime = null` y se vuelve a pedir frame.
- `pause()` → `paused = true`. `resume()` → `paused = false`. Las pulsaciones durante la pausa se ignoran.
- `destroy()` → `cancelAnimationFrame(rafHandle)`, `removeEventListener` de `keydown` (en `window`) y `mousedown` (en `canvas`) con las mismas referencias.

### Reglas de puntuación

| Evento                          | Puntos                                |
| ------------------------------- | ------------------------------------- |
| Cada 40 px recorridos (1 metro) | +1                                    |
| Chispa con racha 1              | +50                                   |
| Chispa con racha 2, 3, 4        | +100, +150, +200                      |
| Chispa con racha 5 o más        | +250                                  |
| Dejar pasar una chispa          | La racha vuelve a 0 (no resta puntos) |

Más es mejor. El score nunca baja.

### Reglas de dificultad

| Nivel | Distancia acumulada (px) | Velocidad (px/s) | Peligros               |
| ----- | ------------------------ | ---------------- | ---------------------- |
| 1     | 0                        | 260              | huecos, púas           |
| 2     | 2400                     | 290              | huecos, púas           |
| 3     | 4800                     | 320              | huecos, púas, barreras |
| 13+   | 28800                    | 620 (tope)       | huecos, púas, barreras |

El número de nivel sigue subiendo tras el 13; la velocidad se queda en 620.

### Renderizado (`draw()`)

Orden de pintado y estilo:

1. Fondo: `fillRect` completo en `#05060a`.
2. Suelo y techo, por tramo sólido: relleno `#0b2a1e`. Techo en `y ∈ [0, CEIL_Y]`, suelo en `y ∈ [FLOOR_Y, H]`. Línea de borde de 2 px en `#00ff88` sobre `y = CEIL_Y` y `y = FLOOR_Y`. Los huecos no se pintan (se ve el fondo).
3. Púas: triángulos de `SPIKE_W × SPIKE_H` rellenos en `#ff006e`, con la punta hacia el interior del pasillo.
4. Barreras: rectángulo `BARRIER_W × BARRIER_H` con relleno `#2a0014` y trazo de 2 px en `#ff006e`.
5. Chispas no tomadas: círculo de radio `SPARK_R` relleno en `#f5ff00`.
6. Cubo: cuadrado `PLAYER_SIZE` relleno en `#e6e9ff` con trazo de 2 px en `#00ff88`. No se dibuja en `gameover`.
7. HUD interno: fuente `15px monospace`, color `#8a8fb5`. Arriba-izquierda `(14, 26)`: `` `${Math.floor(distance / PX_PER_METER)} m` ``. Arriba-derecha `(W - 14, 26)`, alineado a la derecha: `` `RACHA x${Math.min(streak, MAX_STREAK)}` `` solo si `streak >= 2`, en `#f5ff00`.
8. En `gameover`: texto centrado `GAME OVER` (`bold 46px monospace`, `#e6e9ff`) y debajo `` `PUNTAJE: ${score}` `` (`18px monospace`).

Solo se dibujan tramos y chispas con `screenX` dentro de `[-w, W]`.

---

## Plan de implementación

1. **Esqueleto del módulo** — Crear `components/games/vuelco/game.ts` con las interfaces `GameCallbacks` y `GameController`, las constantes, y un `initGame` que obtiene el contexto 2D, pinta el fondo `#05060a` y devuelve `{ pause, resume, destroy }` vacíos. Verificación: `npm run build` y `npm run lint` pasan.

2. **Loop y pasillo estático** — Añadir el estado, el loop `requestAnimationFrame` con `dt` acotado, `pause`/`resume`/`destroy` reales y el dibujo del tramo inicial (suelo, techo) y del cubo apoyado en el suelo. Verificación: `npm run build` pasa; el módulo no deja ningún `requestAnimationFrame` vivo tras `destroy()`.

3. **Vuelco y física vertical** — Registrar `keydown` y `mousedown`, implementar los pasos 1–3 y 5 del tick (buffer, coyote, gravedad, apoyo). Verificación: `npm run lint` pasa; por revisión de código, una pulsación con el cubo apoyado invierte `gDir` y el cubo acaba apoyado en el lado opuesto.

4. **Scroll, niveles y generador** — Implementar el avance de `distance`, la generación por parejas `[seguro, peligro]`, la limpieza de tramos y el cálculo de `level`/`speed` con `onLevel`. Dibujar huecos, púas y barreras. Verificación: `npm run build` pasa.

5. **Colisiones y game over** — Implementar los pasos 6 y 7 del tick y la función de morir con `onGameOver(score)` única. Dibujar el overlay `GAME OVER`. Verificación: `npm run build` pasa; por revisión, `onGameOver` solo puede dispararse una vez por partida.

6. **Chispas y puntuación** — Implementar generación de chispas, pasos 8 y 9 del tick, `onScore` y el HUD interno. Verificación: `npm run build` y `npm run lint` pasan.

La prueba en navegador de este módulo se hace al montar el componente en GJ-vuelco-02; los criterios de aceptación de abajo se validan entonces.

---

## Criterios de aceptación

- [ ] `components/games/vuelco/game.ts` exporta `GameCallbacks`, `GameController` e `initGame(canvas, callbacks): GameController`
- [ ] `GameCallbacks` contiene exactamente `onScore`, `onLevel` y `onGameOver`
- [ ] El módulo no importa React, ni nada de `references/`, ni carga imágenes o audio
- [ ] El cubo avanza solo; no hay control horizontal
- [ ] `Space`, `ArrowUp`, `ArrowDown`, `W`, `S` y clic en el canvas vuelcan la gravedad
- [ ] Con el cubo en el aire, una pulsación no vuelca de inmediato; si se hizo en los últimos 0,12 s antes de aterrizar, se aplica al aterrizar
- [ ] Mantener una tecla pulsada produce un solo vuelco
- [ ] Los primeros 900 px del pasillo no tienen peligros
- [ ] Nunca faltan suelo y techo en el mismo punto
- [ ] Caer por un hueco hasta salir 60 px del canvas termina la partida
- [ ] Tocar púas o una barrera termina la partida
- [ ] Las barreras no aparecen antes del nivel 3
- [ ] El score sube +1 por cada 40 px recorridos
- [ ] Una chispa suma `50 × min(racha, 5)`; dejar pasar una chispa pone la racha a 0
- [ ] El nivel sube cada 2400 px y la velocidad aumenta 30 px/s por nivel hasta 620 px/s
- [ ] `onGameOver` se invoca una sola vez por partida, con el score final
- [ ] `pause()` congela el juego y `resume()` lo reanuda sin salto de posición
- [ ] Tras `destroy()` no quedan listeners de `keydown`/`mousedown` ni frames pendientes
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `npm run lint` pasa sin errores

---

## Decisiones

- **Sí: la gravedad invertida es la única acción del jugador.** El tema es la mecánica central, no un adorno: no hay salto, ni movimiento lateral, ni disparo. Todo peligro se resuelve decidiendo en qué superficie estar y cuándo cruzar.
- **Sí: runner de pasillo con vuelco.** Es un género conocido (correr e invertir gravedad), legible en dos segundos y con puntuación natural por distancia. Nombre, cubo, chispas e identidad visual son propios.
- **No: bloques que "caen hacia arriba" (puzzle de apilado invertido).** Solo invierte el dibujo; la mecánica sería idéntica a `tetris`, ya implementado.
- **No: sala cerrada donde se voltea la gravedad para mover cajas y recoger núcleos.** Interpreta bien el tema, pero exige física de varios cuerpos y diseño de niveles a mano; excede "sin física compleja".
- **Sí: slug `vuelco`, título `VUELCO`.** Una palabra en español, como `ranaria`, `gloton` o `caida`. No choca con ningún id de `GAMES` y es el primer juego de `specs/game-jam/`.
- **Sí: una sola vida, sin `onLives`.** Las partidas son cortas y el reintento es inmediato, igual que en `snake`. Las vidas obligarían a definir un punto de reaparición seguro en un pasillo procedural.
- **Sí: `onLevel`.** El nivel comunica la subida de velocidad y da un segundo dato al HUD.
- **Sí: `requestAnimationFrame` con `dt` acotado a 0,05 s.** El movimiento es continuo (caída y scroll), como en `asteroides`. `setInterval` solo encaja en juegos de pasos discretos como `snake`.
- **Sí: canvas 800×600.** Mismas dimensiones que `asteroides`; el marco CRT ya está probado con ese tamaño.
- **Sí: generación por parejas `[seguro, peligro]` con ancho seguro ligado a la velocidad.** Garantiza que todo peligro es superable con un único vuelco a cualquier nivel, sin necesidad de niveles diseñados.
- **Sí: chispa central solo cuando el vuelco es obligatorio.** Si se colocara en tramos donde no hay que volcar, cogerla dejaría al jugador en el lado del peligro sin espacio para volver. Así premia el momento del vuelco, no un riesgo injusto.
- **Sí: racha con tope ×5 que se rompe al dejar pasar una chispa.** Da profundidad al leaderboard más allá de la distancia sin añadir controles.
- **Sí: buffer de entrada (0,12 s) y coyote (0,08 s).** A 620 px/s una pulsación 2 frames tarde sería muerte; estos márgenes hacen que el control se sienta justo.
- **Sí: sin colisión lateral con el borde de los huecos.** El cubo que entra en un hueco sigue cayendo y muere al salir del canvas. Evita casos límite de colisión y se lee con claridad.
- **No: assets externos.** `references/source-assets/` solo contiene frutas de snake, que no encajan. Todo son rectángulos, triángulos y círculos.
- **No: pantalla de inicio en este spec.** El juego arranca directo, igual que `asteroides`; los 900 px iniciales sin peligros dan tiempo de reacción. La pantalla de inicio va en GJ-vuelco-03.

---

## Riesgos

| Riesgo                                                                          | Mitigación                                                                                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Estado a nivel de módulo sobrevive entre partidas (patrón de asteroides)        | `initGame` reinicia todas las variables de estado antes de arrancar el loop                                            |
| `requestAnimationFrame` o listeners vivos tras desmontar                        | `destroy()` cancela el frame y quita `keydown` de `window` y `mousedown` del `canvas` con las mismas referencias       |
| Pestaña en segundo plano produce un `dt` enorme y el cubo atraviesa superficies | `dt` acotado a 0,05 s; a `MAX_FALL` son 80 px por frame y suelo/techo miden 80 px de grosor con ajuste a la superficie |
| Salto de posición al reanudar tras la pausa                                     | Durante la pausa `lastTime = null`; el primer frame tras `resume()` usa `dt = 0`                                       |
| `Space` hace scroll de la página                                                | `preventDefault()` en `Space`, `ArrowUp` y `ArrowDown`                                                                 |
| Peligro imposible a velocidad alta                                              | El tramo seguro mide al menos `speed × 0,46 + 90` px; nunca hay dos peligros seguidos                                  |
| El cubo se engancha al borde siguiente tras caer en un hueco                    | El apoyo exige que el frame anterior estuviera por encima de la superficie (`prevY`)                                   |
| `onGameOver` disparado varias veces                                             | Morir cambia `state` a `"gameover"` y el `update` sale de inmediato en ese estado                                      |
| Lista de tramos y chispas crece sin límite                                      | Limpieza de todo lo que queda 100 px a la izquierda de la cámara en cada tick                                          |
