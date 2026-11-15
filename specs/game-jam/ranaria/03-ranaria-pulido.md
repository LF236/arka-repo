# SPEC GJ-ranaria-03 — RANARIA: Identidad y Juice

> **Status:** Borrador
> **Depends on:** GJ-ranaria-01, GJ-ranaria-02
> **Date:** 2026-11-15
> **Tema del jam:** cruzar
> **Objetivo:** Dar a RANARIA identidad visual y feedback de eventos en el canvas (salto animado, salpicaduras, impactos, Pulso, nichos, avisos) y una pantalla de inicio con controles, sin cambiar reglas ni puntuación.

---

## Scope

**In:**

- `components/games/ranaria/game.ts` — estados de presentación (intro, animación de salto, partículas, textos flotantes, sacudida, anillo de Pulso, aviso de nivel) y su dibujo.
- Pantalla de inicio con título y controles, dibujada en el canvas.
- Feedback visual de muerte, nicho, Pulso, hoja frágil, tiempo bajo y cambio de nivel.
- Ambientación: estelas, faros y brillo del agua.

**Out of scope:**

- Cambios de reglas, constantes de juego o puntuación del GJ-ranaria-01 (no se altera ninguna).
- Cambios en `index.tsx`, rutas, `GAMES`, Supabase o `references/` → GJ-ranaria-02.
- Sonido (Web Audio o archivos de audio).
- Sprites, atlas o imágenes externas.
- Controles táctiles / mobile / gamepad.
- Supabase Auth y Realtime en el leaderboard.

---

## Data model

Este spec no cambia ninguna regla, constante ni callback del 01. Solo añade estado de presentación a `game.ts`. `GameCallbacks`, `GameController` e `initGame` permanecen idénticos.

### Constantes de presentación

```ts
const HOP_TIME = 0.09; // s de interpolación visual de un salto
const SHAKE_TIME = 0.25; // s de sacudida de pantalla al chocar
const SHAKE_AMP = 6; // px de amplitud máxima
const PARTICLE_CAP = 120; // máximo de partículas vivas
const FLOAT_TIME = 0.9; // s de vida de un texto flotante
const PULSE_FX_TIME = 0.5; // s de expansión del anillo de Pulso
const PULSE_FX_RADIUS = 120; // px (3 celdas)
const LEVEL_BANNER_TIME = 1.4; // s del aviso "NIVEL N"
const LOW_TIME_RATIO = 0.25; // umbral de aviso de tiempo bajo (igual que el tramo magenta de la barra)
```

### Estado añadido

```ts
interface Particle {
  x: number;
  y: number; // px
  vx: number;
  vy: number; // px/s
  life: number; // s restantes
  max: number; // s totales
  color: string;
  size: number; // px
}

interface Floater {
  x: number;
  y: number; // px de inicio
  text: string;
  life: number; // s restantes
  color: string;
}

let intro: boolean; // true hasta el primer movimiento de la partida
let hop: { fromX: number; fromY: number; t: number } | null; // px y s transcurridos
let particles: Particle[];
let floaters: Floater[];
let shake: number; // s restantes de sacudida
let pulseFx: { x: number; y: number; t: number } | null; // centro en px y s transcurridos
let nicheFlash: number[]; // 5 valores: s restantes del destello por nicho
let banner: number; // s restantes del aviso de nivel
let noPulseFlash: number; // s restantes del parpadeo magenta de las pips (0.3 s al disparar)
```

`intro` arranca en `true` y pasa a `false` en el primer movimiento consumido (paso 6 del tick del 01). Antes de eso `started` ya es `false`, así que el temporizador no corre: la intro no altera ninguna partida. `hop`, `pulseFx` y `banner` son puramente visuales: la posición lógica de la rana (`player`) sigue siendo la del 01 y solo cambia la posición dibujada.

### Efectos

| Efecto                    | Disparador                                          | Duración / parámetros                                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pantalla de inicio        | `intro === true`                                    | Panel central `rgba(5,5,15,0.85)` con borde `#00ff88`; título `RANARIA` 40 px `#00ff88` con `shadowBlur 16`; líneas `FLECHAS / WASD · SALTAR`, `ESPACIO · PULSO (CONGELA EL TRÁFICO)`, `LLENA LOS 5 NICHOS`, parpadeo 2 Hz `PULSA UNA FLECHA PARA EMPEZAR`   |
| Salto animado             | Cada movimiento consumido                           | `HOP_TIME` s; posición dibujada = interpolación lineal desde `fromX/fromY` con arco vertical `-8 × sin(π·t/HOP_TIME)` px y escala 1.12 en el punto medio                                                                                                     |
| Sombra de la rana         | Siempre fuera de `dying`                            | Elipse `rgba(0,0,0,0.4)` de 14×6 px bajo la rana; no se desplaza con el arco del salto                                                                                                                                                                       |
| Salpicadura (agua/tiempo) | `die("agua")` o `die("tiempo")` sobre río           | 14 partículas `#00f5ff`/`#ffffff`, velocidad 40–140 px/s hacia arriba con gravedad 300 px/s², vida 0.6 s, tamaño 3 px                                                                                                                                        |
| Impacto (choque)          | `die("choque")`                                     | 18 partículas `#ff006e`/`#f5ff00`, velocidad 60–200 px/s en todas direcciones, vida 0.7 s, tamaño 4 px; `shake = SHAKE_TIME` con desplazamiento aleatorio `±SHAKE_AMP × shake/SHAKE_TIME`                                                                    |
| Nicho alcanzado           | Resolución de nicho exitosa                         | `nicheFlash[i] = 0.5` (el nicho se rellena de `#00ff88` con alpha decreciente); 16 partículas `#00ff88` ascendentes (vida 0.7 s); `Floater` `+N` en `#f5ff00` con N = puntos del nicho incluyendo bonus de tiempo; sube 30 px y se desvanece en `FLOAT_TIME` |
| Pulso                     | Pulso consumido                                     | `pulseFx` crea un anillo `#00f5ff` que crece de 15 a `PULSE_FX_RADIUS` px en `PULSE_FX_TIME` s con alpha 0.8 → 0; los carriles con `frozen < 0.4` parpadean a 6 Hz antes de reanudar                                                                         |
| Pulso sin carga           | Espacio con `pulses === 0` en la autopista          | Las 3 pips de la franja parpadean `#ff006e` 0.3 s; no cambia ningún estado de juego                                                                                                                                                                          |
| Hoja a punto de hundirse  | Hoja con `stand > 0`                                | Vibración horizontal `±1.5 px` a 20 Hz y tinte magenta del 01; al hundirse, 6 partículas `#1faa55` de 3 px con vida 0.5 s y gravedad 300 px/s²                                                                                                               |
| Estelas                   | Barcazas y hojas visibles                           | Cada 0.15 s por plataforma una marca blanca `rgba(255,255,255,0.35)` de 6×2 px detrás del sentido de avance como partícula con vida 0.5 s (cuenta para `PARTICLE_CAP`)                                                                                       |
| Faros                     | Motos y taxis                                       | Gradiente radial `rgba(255,255,200,0.25)` de 36 px de radio delante del vehículo, en el sentido de `dir`; desactivado si el carril está congelado                                                                                                            |
| Brillo del agua           | Siempre                                             | 12 destellos `rgba(0,245,255,0.5)` de 2 px en posiciones pseudoaleatorias fijas del río, con alpha `0.2 + 0.3·sin(clock·2 + i)`                                                                                                                              |
| Aviso de tiempo bajo      | `started` y `timeLeft / timeLimit < LOW_TIME_RATIO` | La barra de la franja parpadea a 4 Hz; viñeta roja `rgba(255,0,110,0.15)` en los bordes con pulso a 2 Hz                                                                                                                                                     |
| Aviso de nivel            | `onLevel` (cambio de nivel)                         | `banner = LEVEL_BANNER_TIME`; texto `NIVEL N` 36 px `#f5ff00` centrado con alpha que sube 0.2 s, mantiene y baja 0.3 s; no pausa la simulación                                                                                                               |
| Vidas en el canvas        | `lives` cambia                                      | Sin efecto extra: las vidas siguen mostrándose solo en el HUD de `index.tsx`                                                                                                                                                                                 |

### Reglas de actualización

- Todos los temporizadores de presentación avanzan con el mismo `dt` del tick del 01 y **también** durante `dying` (para que la muerte se vea), pero no durante `paused`.
- Las partículas se actualizan `x += vx·dt`, `y += vy·dt`, `vy += g·dt` (solo las que usan gravedad) y se eliminan al llegar `life <= 0`. Si `particles.length >= PARTICLE_CAP`, no se crean nuevas.
- El orden de dibujo es: fondo y zonas → brillo del agua → plataformas y estelas → vehículos y faros → rana → partículas → anillo de Pulso → textos flotantes → viñeta de tiempo bajo → aviso de nivel → intro. La sacudida aplica `ctx.translate` aleatorio a todo salvo a la franja de estado y la intro.

### Cambios respecto al 01

| Elemento del 01         | Cambio                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Constantes de juego     | Ninguno; las constantes de presentación son adicionales                                     |
| Reglas y puntuación     | Ninguno                                                                                     |
| Callbacks               | Ninguno; `onScore`, `onLives`, `onLevel`, `onGameOver` siguen igual                         |
| `initGame` / firma      | Ninguno                                                                                     |
| Tick, paso 6            | Además de mover, crea `hop` y pasa `intro = false`                                          |
| Tick, pasos 5–6 y `die` | Disparan los efectos de la tabla (partículas, sacudida, flotantes, `pulseFx`, `nicheFlash`) |
| Render                  | Las posiciones de la rana se dibujan interpoladas; se añaden las capas de la tabla          |
| `destroy()`             | Sin cambios; los arrays de presentación se descartan con el cierre de `initGame`            |

---

## Plan de implementación

1. **Infraestructura de efectos** — Añadir constantes, tipos y estado de presentación; función de actualización de partículas/flotantes/temporizadores con tope de `PARTICLE_CAP` y orden de dibujo. Verificación: `npm run build` y `npm run lint` pasan; el juego sigue jugable igual que tras el 02.
2. **Intro y salto animado** — Pantalla de inicio con controles, `intro`, `hop` con arco y sombra. Verificación: al abrir `/juego/ranaria/jugar` aparece la intro y se oculta con la primera flecha; el salto se anima y la rana ocupa la casilla correcta al terminar.
3. **Efectos de eventos** — Salpicadura, impacto con sacudida, nicho con destello y flotante, Pulso con anillo y parpadeo de carriles, Pulso sin carga. Verificación: cada evento muestra su efecto y no cambia la puntuación ni las vidas respecto al comportamiento del 01.
4. **Avisos y ambientación** — Hoja que vibra y se desmigaja, estelas, faros, brillo del agua, tiempo bajo y aviso de nivel. Verificación: al pasar 5 nichos aparece `NIVEL 2` sin pausar el juego; con 25% del tiempo restante la barra parpadea.
5. **Revisión de rendimiento** — Comprobar un cierre de partida con muchas partículas y reinicios. Verificación: 60 fps estables sobre el canvas, sin partículas residuales tras "JUGAR DE NUEVO".

---

## Criterios de aceptación

- [ ] Al abrir el juego se muestra la pantalla de inicio con título y controles, y desaparece con el primer movimiento.
- [ ] Mientras la intro está visible el temporizador no corre y no se pierde ninguna vida.
- [ ] El salto dura 0.09 s con un pequeño arco y la posición lógica no cambia respecto al 01.
- [ ] Morir en el agua muestra salpicadura cian; morir por choque muestra partículas magenta/amarillas y sacude el canvas 0.25 s.
- [ ] Llegar a un nicho lo destella en verde y muestra un texto `+N` ascendente con los puntos reales obtenidos.
- [ ] Usar el Pulso muestra un anillo cian de 120 px y los carriles congelados parpadean antes de reanudarse.
- [ ] Pulsar Espacio sin cargas en la autopista hace parpadear las pips en magenta y no cambia el estado de juego.
- [ ] Las hojas vibran con la rana encima y sueltan partículas al hundirse.
- [ ] Con menos del 25% del tiempo restante la barra parpadea a 4 Hz y aparece la viñeta roja.
- [ ] Al subir de nivel aparece `NIVEL N` durante 1.4 s sin pausar la simulación.
- [ ] Nunca hay más de 120 partículas vivas.
- [ ] La puntuación, vidas, tiempos y velocidades coinciden con las del GJ-ranaria-01 (ninguna constante de juego cambió).
- [ ] Tras "JUGAR DE NUEVO" no quedan partículas, textos ni anillos de la partida anterior y la intro vuelve a mostrarse.
- [ ] Pausar congela también los efectos; reanudar los continúa.
- [ ] `npm run build` completa sin errores TypeScript.
- [ ] `npm run lint` pasa sin errores.

---

## Decisiones

- **Sí: pulido en lugar de feature** — Las reglas nuevas del 01 (Pulso, hojas frágiles, nichos con bonus de tiempo) ya aportan alcance suficiente y un jam de ~450 líneas no necesita más sistemas. Lo que más separa a RANARIA de un cruce genérico es el feedback: sin salto animado ni impactos legibles, morir se siente arbitrario. Un sistema de power-ups o jefe duplicaría el giro del Pulso, y un modo alternativo exigiría un segundo leaderboard.
- **Sí: no se escribe un cuarto spec** — El pulido cubre en un solo spec todo lo presentable; sonido sería un alcance distinto y queda fuera.
- **Sí: intro como estado de presentación** — El temporizador del 01 ya espera al primer movimiento, por lo que la intro no cambia el resultado de ninguna partida.
- **Sí: la sacudida solo en choque** — El agua es silenciosa y el atropello es violento; la diferencia comunica la causa de la muerte.
- **Sí: efectos temporizados con el mismo `dt`** — Evita un segundo reloj y los hace pausar con el juego.
- **Sí: tope de 120 partículas** — Protege el frame rate con estelas, nichos y choques simultáneos.
- **No: sonido sintetizado** — Excede el pulido visual y cambia la superficie del módulo; sería una feature propia.
- **No: efectos de vidas dentro del canvas** — Las vidas ya están en el HUD de `index.tsx`; duplicarlas obligaría a un callback o estado más.
- **No: cambios de tamaño del canvas** — Debe seguir siendo 800×600 como en el 01 y el 02.

---

## Riesgos

| Riesgo                                                              | Mitigación                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Caída de fps por partículas, gradientes de faros y `shadowBlur`     | `PARTICLE_CAP = 120`; faros y brillos usan pocos elementos; `shadowBlur` solo en la rana y el título                |
| El salto animado desincroniza lo que se ve de la colisión real      | La lógica usa siempre `player` (instantáneo); `HOP_TIME` es solo 0.09 s, menor que `DEATH_TIME`                     |
| La sacudida desplaza la franja de estado y dificulta leer el tiempo | La sacudida excluye la franja de estado y la intro                                                                  |
| Efectos activos tras desmontar o reiniciar                          | Todo el estado vive dentro de `initGame`; `destroy()` del 01 cancela el rAF y el siguiente `initGame` parte de cero |
| La intro se interpreta como pausa del juego                         | La intro desaparece con cualquier movimiento; el botón PAUSA del HUD funciona igual con la intro visible            |
| `NIVEL N` tapa la rana en un momento crítico                        | El texto está centrado entre filas 6 y 7 con alpha ≤ 0.9 y dura solo 1.4 s sin bloquear input                       |
