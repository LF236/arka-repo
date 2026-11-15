# SPEC GJ-ranaria-01 — RANARIA: Diseño y Lógica del Juego

> **Status:** Borrador
> **Depends on:** SPEC 05
> **Date:** 2026-11-15
> **Tema del jam:** cruzar
> **Objetivo:** Escribir desde cero `components/games/ranaria/game.ts`, un juego de cruce por carriles en canvas 800×600 donde una rana-dron atraviesa una autopista y un río hasta cinco nichos de carga, con temporizador por intento, 3 vidas y un Pulso que congela el tráfico.

---

## Scope

**In:**

- `components/games/ranaria/game.ts` — lógica completa y render en canvas, exponiendo `initGame(canvas, callbacks): GameController`.
- Mecánicas: movimiento por casillas, 6 carriles de vehículos, 5 carriles de plataformas (barcazas y hojas frágiles), 5 nichos de meta, temporizador por intento, 3 vidas, Pulso, niveles con dificultad creciente.
- Puntuación y condición de game over.
- Render con primitivas de canvas (sin imágenes ni atlas).

**Out of scope:**

- `components/games/ranaria/index.tsx`, ruta `app/juego/ranaria/jugar/page.tsx`, registro en `CANVAS_GAMES`, entrada en `GAMES`, INSERT en Supabase y fila en `references/implemented-games.md` → GJ-ranaria-02.
- Efectos de "juice", animación de salto, partículas, pantalla de inicio/controles, aviso de nivel → GJ-ranaria-03.
- Sonido (sin Web Audio ni archivos de audio).
- Controles táctiles / mobile / gamepad.
- Supabase Auth (`user_id` permanece `null`) y Realtime en el leaderboard.
- Cambios en `lib/data.ts`, `app/salon/page.tsx` o `app/juego/[id]/page.tsx`.

---

## Data model

### Interfaz del módulo

```ts
// components/games/ranaria/game.ts

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

`initGame` emite al arrancar `onScore(0)`, `onLives(3)` y `onLevel(1)`. `destroy()` es idempotente (se puede llamar dos veces: `restart` del componente y cleanup del `useEffect` lo hacen).

### Tablero

Canvas **800×600**, cuadrícula de **20 columnas × 15 filas**, celda de 40 px. Origen arriba-izquierda. Unidades de movimiento de obstáculos: **celdas/segundo**.

| Fila | Zona                          | Contenido                                        |
| ---- | ----------------------------- | ------------------------------------------------ |
| 0    | Metas                         | 5 nichos de 2 celdas separados por muros         |
| 1–5  | Río de datos                  | 5 carriles de plataformas (agua mortal)          |
| 6    | Mediana                       | Zona segura                                      |
| 7–12 | Autopista neón                | 6 carriles de vehículos                          |
| 13   | Arcén (inicio)                | Zona segura; la rana reaparece aquí en la col. 9 |
| 14   | Franja de estado (no jugable) | Barra de tiempo + cargas de Pulso                |

### Constantes

```ts
const W = 800;
const H = 600;
const CELL = 40;
const COLS = 20;
const ROW_GOAL = 0;
const ROW_MEDIAN = 6;
const ROW_START = 13;
const ROW_STRIP = 14;
const RIVER_FIRST = 1; // filas 1..5
const RIVER_LAST = 5;
const ROAD_FIRST = 7; // filas 7..12
const ROAD_LAST = 12;
const START_COL = 9;
const START_LIVES = 3;
const NICHES = [1, 5, 9, 13, 17]; // columna izquierda; cada nicho mide 2 celdas
const NICHE_W = 2;

const TIME_LIMIT_BASE = 30; // s por intento en nivel 1
const TIME_LIMIT_MIN = 18;
const TIME_LIMIT_STEP = 1.5; // s menos por nivel
const SPEED_STEP = 0.12; // +12% velocidad por nivel
const SPEED_CAP = 2.2; // multiplicador máximo
const FRAGILE_BASE = 1.2; // s de pie sobre una hoja antes de hundirse (nivel 1)
const FRAGILE_MIN = 0.6;
const FRAGILE_STEP = 0.1;
const SINK_TIME = 2.0; // s que la hoja permanece hundida
const HIT_MARGIN = 0.15; // celdas recortadas a cada lado del hitbox de vehículos
const PULSE_START = 1;
const PULSE_MAX = 3;
const PULSE_TIME = 1.6; // s de congelación
const DEATH_TIME = 0.9; // s de pausa tras morir
const MAX_DT = 0.05; // s, tope del delta por frame

const ROW_POINTS = 10; // por fila nueva alcanzada en el intento
const NICHE_POINTS = 100;
const TIME_BONUS = 10; // por segundo (redondeado hacia arriba) restante
const LEVEL_BONUS = 300; // al llenar los 5 nichos
```

### Carriles (nivel 1; velocidad real = `speed × mult`)

```ts
type LaneKind = "moto" | "taxi" | "camion" | "barcaza" | "hoja";

interface Item {
  x: number; // celdas, borde izquierdo
  stand: number; // s acumulados con la rana encima (solo hojas)
  sunk: number; // s restantes hundida (solo hojas); >0 = no sólida
}

interface Lane {
  row: number;
  kind: LaneKind;
  dir: 1 | -1;
  speed: number;
  len: number; // celdas
  spacing: number; // celdas entre bordes izquierdos consecutivos
  ring: number; // spacing × nº de ítems; longitud del bucle
  frozen: number; // s restantes de congelación (solo carriles de autopista)
  items: Item[];
}
```

| Fila | Zona  | kind      | dir | speed | len | spacing |
| ---- | ----- | --------- | --- | ----- | --- | ------- |
| 12   | road  | `moto`    | +1  | 3.2   | 1   | 6       |
| 11   | road  | `taxi`    | -1  | 2.4   | 2   | 7       |
| 10   | road  | `camion`  | +1  | 1.8   | 3   | 10      |
| 9    | road  | `moto`    | -1  | 4.0   | 1   | 5       |
| 8    | road  | `taxi`    | +1  | 2.8   | 2   | 6       |
| 7    | road  | `camion`  | -1  | 2.2   | 3   | 9       |
| 5    | river | `barcaza` | -1  | 1.5   | 3   | 7       |
| 4    | river | `hoja`    | +1  | 1.1   | 2   | 5       |
| 3    | river | `barcaza` | -1  | 2.0   | 4   | 10      |
| 2    | river | `hoja`    | +1  | 1.3   | 2   | 6       |
| 1    | river | `barcaza` | -1  | 2.2   | 3   | 8       |

Construcción de un carril (`buildLanes(level)`): `count = ceil((COLS + len + 4) / spacing)`, `ring = spacing × count`, ítem `i` en `x = -len - 2 + i × spacing + offset`, con `offset = Math.random() × spacing` por carril. Al moverse, cuando un ítem con `dir = +1` supera `COLS + 2` se le resta `ring`; con `dir = -1` y `x + len < -2` se le suma `ring`.

### Estado mutable

```ts
interface Player {
  x: number; // celdas (float en el río, entero en tierra), borde izquierdo
  row: number; // fila entera
}

let player: Player;
let lanes: Lane[];
let filled: boolean[]; // 5 nichos ocupados
let score: number;
let lives: number;
let level: number;
let pulses: number;
let timeLeft: number; // s del intento actual
let started: boolean; // el temporizador corre solo tras el primer movimiento del intento
let rowBest: number; // fila más alta (número menor) alcanzada en el intento
let dying: number; // s restantes de pausa por muerte; 0 = jugando
let deathKind: "agua" | "choque" | "tiempo" | null;
let queuedMove: { dx: number; dy: number } | null;
let queuedPulse: boolean;
let clock: number; // s totales jugados (animación del fondo)
let paused: boolean;
let gameOver: boolean;
let rafId: number;
let lastTs: number;
```

### Controles

| Entrada                      | Acción                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| Flechas / WASD               | Mover una casilla (arriba, abajo, izquierda, derecha)       |
| Espacio                      | Pulso: congela vehículos de la fila actual y las adyacentes |
| (Botones HUD de `index.tsx`) | PAUSA / FIN / SALIR → GJ-ranaria-02                         |

Los `keydown` se registran en `window`; se ignora `e.repeat` (un toque = una casilla) y se llama `preventDefault()` para flechas y espacio. Solo se guarda **un** movimiento en `queuedMove` (el último pulsado antes del siguiente tick).

### Reglas

- **Movimiento:** una casilla por pulsación, instantáneo en la lógica. Horizontal: `x ± 1`, acotado a `[0, COLS - 1]`. Vertical: `row ± 1`, acotado a `[ROW_GOAL, ROW_START]`. Al entrar en una fila que no es de río, `x = Math.round(x)`; en el río `x` conserva su valor flotante.
- **Temporizador:** `timeLeft` se reinicia a `timeLimit(level) = max(TIME_LIMIT_MIN, TIME_LIMIT_BASE - TIME_LIMIT_STEP × (level - 1))` al inicio de cada intento y no corre hasta el primer movimiento (`started = true`).
- **Vehículos:** matan al solaparse con el hitbox de la rana: `player.x < item.x + len - HIT_MARGIN` y `player.x + 1 > item.x + HIT_MARGIN`, en la fila del carril.
- **Río:** sin plataforma sólida bajo el centro (`cx = player.x + 0.5` dentro de `[item.x, item.x + len]` y `sunk === 0`) la rana se ahoga. Sobre una plataforma, la rana se desplaza con ella (`x += dir × speed × mult × dt`). Si `cx < 0` o `cx > COLS` muere arrastrada fuera de pantalla.
- **Hojas frágiles:** mientras la rana está encima, `stand += dt`; al llegar a `fragileTime(level) = max(FRAGILE_MIN, FRAGILE_BASE - FRAGILE_STEP × (level - 1))` la hoja se hunde (`sunk = SINK_TIME`, `stand = 0`). Sin la rana encima, `stand` decae `dt` por tick hasta 0. Una hoja hundida no es sólida y el contador `sunk` baja hasta 0.
- **Pulso (Espacio):** solo si `pulses > 0` y `player.row` está en `[ROAD_FIRST, ROAD_LAST]`. Pone `frozen = PULSE_TIME` en los carriles de las filas `row - 1`, `row` y `row + 1` que sean de autopista y consume una carga. Un carril congelado no se mueve. Fuera de la autopista el Pulso no se consume. No afecta al río.
- **Nichos (fila 0):** al moverse a la fila 0, el centro `cx` debe caer en `[n, n + NICHE_W)` de un nicho libre; si cae en un muro o en un nicho ocupado, la rana muere (`"choque"`).
- **Nicho alcanzado:** `filled[i] = true`, puntos (ver Puntuación), `pulses = min(PULSE_MAX, pulses + 1)`, la rana reaparece en `ROW_START` sin perder vida. Con los 5 nichos llenos: bonus de nivel, `level++`, `filled` a `false`, `buildLanes(level)`.

### Puntuación

| Evento                             | Puntos                                               |
| ---------------------------------- | ---------------------------------------------------- |
| Fila nueva alcanzada en el intento | `ROW_POINTS` (10); solo si `row < rowBest`           |
| Nicho alcanzado                    | `NICHE_POINTS` (100) + `ceil(timeLeft) × TIME_BONUS` |
| Los 5 nichos llenos                | `LEVEL_BONUS` (300)                                  |

`rowBest` se reinicia a `ROW_START` al inicio de cada intento (reaparición tras muerte o nicho), de modo que retroceder y volver a subir no puntúa dos veces, pero cada intento puede puntuar sus 13 filas. Ejemplo: un intento perfecto de 15 s sobrantes vale 130 + 100 + 150 = 380. Cada cambio de `score` llama `callbacks.onScore(score)`.

### Dificultad

- `mult(level) = min(SPEED_CAP, 1 + SPEED_STEP × (level - 1))` multiplica la velocidad de **todos** los carriles.
- `timeLimit(level)` y `fragileTime(level)` disminuyen por nivel (ver Reglas). Alcanzan sus mínimos en los niveles 9 y 7; el multiplicador de velocidad topa en el nivel 11.
- No hay fin de juego por victoria: el juego es endless hasta perder las 3 vidas.

### Algoritmo del tick (`requestAnimationFrame`)

1. Calcular `dt = min(MAX_DT, (ts - lastTs) / 1000)`; `lastTs = ts`. Programar el siguiente frame mientras no esté destruido.
2. Si `paused` o `gameOver`: solo renderizar y terminar.
3. `clock += dt`.
4. Si `dying > 0`: `dying -= dt`; al llegar a 0, `respawn()` (o nada si `gameOver`); renderizar y terminar el tick. Durante `dying` se ignoran `queuedMove` y `queuedPulse`.
5. Consumir `queuedPulse`: aplicar la regla del Pulso.
6. Consumir `queuedMove`: aplicar el movimiento; `started = true`; si la nueva `row < rowBest`, `score += ROW_POINTS`, `rowBest = row`, `onScore`. Si la nueva fila es 0, resolver nicho (ver Reglas) y, si hubo nicho, saltar al paso 11.
7. Mover los carriles: para cada carril, si `frozen > 0` restar `dt` y no mover; si no, `x += dir × speed × mult × dt` por ítem y aplicar el wrap.
8. Si `started`: `timeLeft -= dt`; si `timeLeft <= 0`, `die("tiempo")` y terminar el tick.
9. Actualizar hojas frágiles: `stand`/`sunk` según las reglas, usando la posición de la rana del paso 6.
10. Resolver la fila de la rana: autopista → colisión con vehículos (`die("choque")`); río → buscar plataforma sólida, arrastrar o `die("agua")`; mediana y arcén → nada.
11. Renderizar.

`die(kind)`: `deathKind = kind`, `lives--`, `callbacks.onLives(lives)`, `dying = DEATH_TIME`. Si `lives === 0`: `gameOver = true` y, **después** de `onLives(0)`, `callbacks.onGameOver(score)` (una sola vez). `respawn()`: `player = { x: START_COL, row: ROW_START }`, `timeLeft = timeLimit(level)`, `started = false`, `rowBest = ROW_START`, `deathKind = null`, `queuedMove = null`.

`pause()` y `resume()` solo conmutan `paused` (el rAF sigue corriendo para repintar y se reanuda con `lastTs` actualizado para evitar un salto de `dt`). `destroy()` cancela `cancelAnimationFrame(rafId)`, elimina el listener `keydown` y marca el juego como destruido.

### Renderizado (primitivas de canvas, fuente `monospace`)

| Elemento           | Especificación                                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fondo general      | `#05050f`                                                                                                                                                                                                                                          |
| Metas (fila 0)     | Muros `#14142e` con borde `#ff00ff`; nichos libres `#001a14` con borde `#00ff88`; ocupados con mini rana verde                                                                                                                                     |
| Río (filas 1–5)    | `#001a33`; líneas de ola `rgba(0,245,255,0.14)` de 2 px desplazadas con `clock`                                                                                                                                                                    |
| Mediana (fila 6)   | `#1a1030` con puntos `#ff00ff` a 25% de alpha cada 20 px                                                                                                                                                                                           |
| Autopista (7–12)   | `#0d0d18`; separadores discontinuos `rgba(255,255,255,0.15)` entre carriles                                                                                                                                                                        |
| Arcén (fila 13)    | `#14142a`                                                                                                                                                                                                                                          |
| Moto               | Rect `#ff006e` de `len×CELL - 8` por 16 px, faro `#ffffff` de 4 px en el lado de `dir`                                                                                                                                                             |
| Taxi               | Rect redondeado `#f5ff00`, ventana `#05050f`, 22 px de alto                                                                                                                                                                                        |
| Camión             | Remolque `#ff7700` + cabina `#00f5ff` en el lado de `dir`, 26 px de alto                                                                                                                                                                           |
| Barcaza            | Rect `#00a0b0` con rayas `#007080` cada 10 px, 24 px de alto                                                                                                                                                                                       |
| Hoja frágil        | Rect redondeado `#1faa55`; con `stand > 0` se tiñe a `#ff006e` proporcional a `stand / fragileTime`; hundida: solo un círculo de ondas `rgba(0,245,255,0.3)`                                                                                       |
| Vehículo congelado | Mismo color con `globalAlpha 0.55` y borde `#00f5ff` de 2 px                                                                                                                                                                                       |
| Rana-dron          | Círculo `#00ff88` de radio 15 con `shadowBlur 12`, dos ojos blancos de radio 4 con pupila `#000`, orientados a la última dirección movida                                                                                                          |
| Muerte             | Mientras `dying > 0`: anillo `#00f5ff` (agua/tiempo) o `#ff006e` (choque) que crece de 15 a 40 px, la rana oculta                                                                                                                                  |
| Franja de estado   | Barra de tiempo: ancho `W - 220` × 14 px en `x=16`; `#00ff88` si `timeLeft/timeLimit > 0.5`, `#f5ff00` si `> 0.25`, `#ff006e` si no. A la derecha, texto `PULSO` `#aaa` 11 px y 3 círculos de radio 7: `#00f5ff` llenos o contorno si no hay carga |

### Claves `localStorage`

El módulo `game.ts` no usa `localStorage` (lo hace `index.tsx` → GJ-ranaria-02).

---

## Plan de implementación

1. **Esqueleto del módulo** — Crear `components/games/ranaria/game.ts` con interfaces, constantes, estado, `initGame` que fija `canvas.width = W` / `canvas.height = H`, arranca el rAF, emite `onScore(0)`, `onLives(3)`, `onLevel(1)` y devuelve `{ pause, resume, destroy }` idempotente. Renderiza solo las zonas del tablero (fondo, río, mediana, autopista, arcén, metas, franja). Verificación: `npm run build` y `npm run lint` pasan.
2. **Carriles y obstáculos** — Implementar la tabla de carriles, `buildLanes(level)`, movimiento con wrap, `mult(level)` y el dibujo de motos, taxis, camiones, barcazas y hojas. Verificación: `npm run build` y `npm run lint` pasan.
3. **Jugador y movimiento** — Listener `keydown` (flechas/WASD, `e.repeat` ignorado, `preventDefault`), `queuedMove`, movimiento por casillas con acotado y redondeo en tierra, rana dibujada con orientación, `started` y `rowBest` + puntos por fila. Verificación: `npm run build` y `npm run lint` pasan.
4. **Colisiones, muerte y vidas** — Colisión con vehículos, ahogamiento y arrastre en el río, hojas frágiles, temporizador, `die`/`respawn`, `dying`, orden `onLives(0)` → `onGameOver(score)` una sola vez. Verificación: `npm run build` y `npm run lint` pasan.
5. **Nichos, Pulso y niveles** — Resolución de la fila 0, puntos de nicho con bonus de tiempo, bonus y avance de nivel con `onLevel`, recarga de Pulso, congelación de carriles y su tinte. Verificación: `npm run build` y `npm run lint` pasan.

Las pruebas jugables de `game.ts` se ejecutan en GJ-ranaria-02, una vez exista el componente y la ruta.

---

## Criterios de aceptación

- [ ] `components/games/ranaria/game.ts` exporta `initGame`, `GameCallbacks` y `GameController` con las firmas del Data model.
- [ ] `game.ts` no importa nada de React, `references/` ni usa `localStorage`.
- [ ] El canvas se fija a 800×600 y el tablero tiene 15 filas de 40 px (0 metas, 1–5 río, 6 mediana, 7–12 autopista, 13 arcén, 14 franja).
- [ ] Una pulsación de flecha/WASD mueve exactamente una casilla; mantener la tecla no repite el movimiento.
- [ ] El temporizador no corre hasta el primer movimiento de cada intento y se reinicia al reaparecer.
- [ ] Alcanzar una fila nueva suma 10 puntos solo una vez por intento.
- [ ] Tocar un vehículo, caer al agua, ser arrastrado fuera de pantalla o agotar el tiempo resta una vida y llama `onLives`.
- [ ] Al perder la última vida se llama `onLives(0)` y después `onGameOver(score)`, una sola vez.
- [ ] Una hoja frágil se hunde tras `fragileTime(level)` s con la rana encima y reaparece tras 2 s.
- [ ] Llegar a un nicho libre suma 100 + `ceil(timeLeft) × 10`, recarga una carga de Pulso (máx. 3) y reaparece la rana sin perder vida.
- [ ] Llegar a un muro o a un nicho ocupado mata a la rana.
- [ ] Llenar los 5 nichos suma 300, sube `level`, llama `onLevel` y regenera los carriles con mayor velocidad.
- [ ] Espacio congela los carriles de autopista de la fila actual y las adyacentes 1.6 s y gasta una carga; fuera de la autopista o sin cargas no hace nada.
- [ ] `pause()` congela la simulación y `resume()` la reanuda sin salto de `dt`; `destroy()` cancela el rAF y quita el listener y puede llamarse dos veces.
- [ ] `npm run build` completa sin errores TypeScript.
- [ ] `npm run lint` pasa sin errores.

---

## Decisiones

- **Sí: interpretación del tema "cruzar"** — Cruzar es la mecánica central: la rana atraviesa dos obstáculos de naturaleza opuesta (tráfico que mata al tocarlo, río que mata si _no_ lo tocas) hacia los nichos. La tensión nace de alternar entre evitar y depender de lo que se mueve.
- **Sí: giro propio, el Pulso** — Espacio congela el tráfico cercano; se recarga llenando nichos. Convierte el riesgo de la autopista en una decisión de recursos (gastar ahora o guardarlo) sin trivializar el río, que no se afecta.
- **Sí: hojas frágiles que se hunden bajo el peso** — Las hojas penalizan quedarse quieto, al contrario de las barcazas, que son refugio seguro. Obliga a leer el río en lugar de "esperar el tronco bueno".
- **Sí: identidad "rana-dron" y nichos de carga** — Ambientación de ciudad-circuito neón (autopista neón, río de datos, nichos de carga), con motos, taxis, camiones, barcazas y hojas como piezas propias; coherente con la estética CRT del sitio. No recrea ningún título concreto (nombre, personajes, sprites ni disposición de niveles).
- **Sí: temporizador que arranca en el primer movimiento** — Elimina la pérdida injusta de tiempo al empezar o reaparecer y hace innecesaria una pantalla de espera en la lógica base; la pantalla de inicio es solo presentación → GJ-ranaria-03.
- **Sí: 3 vidas** — Cada intento es corto (≤ 30 s) y la muerte es frecuente en el género; una sola vida terminaría la partida en segundos y no daría puntuaciones comparables. Tres da margen para aprender el patrón de cada nivel, coincide con la ficha del catálogo ("3 vidas") y con Arkanoid/Asteroides. No hay vidas extra: el score ya premia la eficiencia con el bonus de tiempo.
- **Sí: `requestAnimationFrame` con `dt` acotado** — Obstáculos de movimiento continuo y arrastre sobre plataformas requieren simulación por tiempo, como asteroides; `setInterval` (Snake) solo encaja con pasos discretos. `MAX_DT = 0.05` evita atravesar obstáculos tras cambiar de pestaña.
- **Sí: canvas 800×600** — `.crt-screen` usa `aspect-ratio: 4/3`; una cuadrícula de 20×15 celdas de 40 px llena exactamente ese formato sin cambios de CSS.
- **Sí: nichos de 2 celdas** — Con `x` flotante en el río, un nicho de 1 celda exigiría precisión de píxel; 2 celdas mantienen el reto sin ser frustrante.
- **Sí: slug `ranaria`, título RANARIA, categoría ARCADE, color `green`, cover `cover-rana`** — La entrada mock ya existe en `GAMES` con ese id, título, categoría, color y cover; el 02 la actualiza en lugar de añadir otra. Recuento de color en `lib/data.ts`: cyan 3, magenta 3, yellow 3, green 3 (empate); desempate por juegos reales (`references/implemented-games.md`): green 0, magenta 1, yellow 1, cyan 2, así que `green` es el menos usado. `cover-rana` ya existe en `app/globals.css`, no hace falta CSS nuevo.
- **Sí: callbacks `onScore`, `onLives`, `onLevel`, `onGameOver`** — El juego tiene vidas y niveles visibles en el HUD, igual que asteroides. No hay callback de Pulso: sus cargas se dibujan dentro del canvas (franja de estado).
- **No: concepto "cruzar" como puente de piezas (puzzle de construir el camino)** — Más cercano a un puzzle sin tensión arcade y sin mecánica de reflejos para un leaderboard por puntos.
- **No: carriles generados proceduralmente por nivel** — La tabla fija de 11 carriles más el multiplicador mantiene `game.ts` en ~450 líneas y deja un patrón aprendible; el patrón propio por nivel sería una feature aparte.
- **No: atlas ni sprites** — Todo son rectángulos y círculos de canvas; el spec de Snake ya cubre el uso de atlas, aquí no aporta.

---

## Riesgos

| Riesgo                                           | Mitigación                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| SSR del canvas (`window`/`document` indefinidos) | `game.ts` solo toca `window` dentro de `initGame`; el componente se carga con `dynamic(..., { ssr: false })` → GJ-ranaria-02 |
| `dt` enorme al volver de otra pestaña            | `MAX_DT = 0.05` y `lastTs` se reinicia en `resume()`                                                                         |
| Listeners o rAF activos tras desmontar           | `destroy()` cancela el rAF, quita `keydown` y es idempotente                                                                 |
| Doble `onGameOver` (muerte + botón FIN del HUD)  | `gameOver` bloquea el tick; `onGameOver` solo se dispara una vez desde `die()`                                               |
| Arrastre en el río deja `x` fuera de rango       | Muerte por `cx < 0` o `cx > COLS` en el paso 10                                                                              |
| Nivel imposible por velocidades altas            | `SPEED_CAP = 2.2` y mínimos de `timeLimit`/`fragileTime`; los espaciados fijos garantizan huecos de ≥ 3 celdas               |
| Scroll de la página con flechas y espacio        | `preventDefault()` en `keydown` para esas teclas                                                                             |
