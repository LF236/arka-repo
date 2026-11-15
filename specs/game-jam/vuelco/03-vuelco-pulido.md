# SPEC GJ-vuelco-03 — VUELCO: Pulido e Identidad

> **Status:** Borrador
> **Depends on:** GJ-vuelco-01, GJ-vuelco-02
> **Date:** 2026-11-14
> **Tema del jam:** gravedad invertida
> **Objetivo:** Añadir a VUELCO una pantalla de inicio con controles y efectos visuales en canvas que hagan visible la dirección de la gravedad y den respuesta a cada evento, sin cambiar reglas ni puntuación.

---

## Scope

**In:**

- `components/games/vuelco/game.ts` — pantalla de inicio, efectos visuales y feedback de eventos. Solo código de presentación y un estado previo `"ready"`.

**Out of scope:**

- Reglas, constantes de física, generación del pasillo, puntuación y dificultad → GJ-vuelco-01 (no se modifican)
- Firma de `initGame`, `GameCallbacks` y `GameController` → GJ-vuelco-01 (no se modifican)
- `components/games/vuelco/index.tsx`, `lib/data.ts`, rutas, Supabase → GJ-vuelco-02
- Cover `cover-vuelco` en `app/globals.css` → GJ-vuelco-02 (ya definido allí; este spec no lo toca)
- Efectos de sonido y música
- Assets externos: todos los efectos son primitivas de canvas
- Efectos CSS o React fuera del canvas

---

## Data model

### Estado nuevo

```ts
// Sustituye al tipo de state de GJ-vuelco-01
let state: "ready" | "playing" | "gameover";

interface Particle {
  x: number; // coordenadas de pantalla
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  life: number;
  color: string;
}

interface FloatText {
  x: number; // coordenadas de pantalla
  y: number;
  text: string;
  ttl: number;
}

interface Star {
  x: number;
  y: number;
  layer: 0 | 1;
}

let particles: Particle[];
let floatTexts: FloatText[];
let stars: Star[];
let trail: Array<{ y: number }>; // últimas posiciones verticales del cubo
let cubeAngle: number; // rad, solo visual
let squashTimer: number;
let shakeTimer: number;
let bannerTimer: number;
let flipFlashTimer: number;
let reducedMotion: boolean; // matchMedia("(prefers-reduced-motion: reduce)").matches
```

### Constantes nuevas

```ts
const TRAIL_LEN = 8;
const SQUASH_TIME = 0.12;
const SHAKE_TIME = 0.35;
const SHAKE_AMP = 8;
const BANNER_TIME = 1.2;
const FLIP_FLASH_TIME = 0.15;
const FLOAT_TEXT_TIME = 0.6;
const MAX_PARTICLES = 120;
const STARS_PER_LAYER = 40;
const STAR_PARALLAX = [0.2, 0.5]; // fracción de speed por capa
const CHEVRON_SPACING = 80; // px entre columnas de flechas de gravedad
const CHEVRON_DRIFT = 60; // px/s
```

### Pantalla de inicio (estado `"ready"`)

- `initGame` arranca en `"ready"` en lugar de `"playing"`.
- En `"ready"` el `update` no avanza `distance`, no genera peligros y no puntúa. El cubo está apoyado en el suelo del tramo inicial.
- La primera pulsación de vuelco (teclado o clic) cambia a `"playing"` y **no** vuelca: la partida empieza con el cubo en el suelo, exactamente en el estado inicial de GJ-vuelco-01.
- Contenido dibujado sobre el pasillo estático, centrado en `x = 400`:

| Elemento  | Texto                                 | Fuente                | Color     | y   |
| --------- | ------------------------------------- | --------------------- | --------- | --- |
| Título    | `VUELCO`                              | `bold 64px monospace` | `#00ff88` | 250 |
| Lema      | `LA GRAVEDAD ES TUYA`                 | `16px monospace`      | `#e6e9ff` | 290 |
| Controles | `ESPACIO / CLIC — VOLCAR LA GRAVEDAD` | `15px monospace`      | `#8a8fb5` | 350 |
| Llamada   | `PULSA PARA EMPEZAR`                  | `15px monospace`      | `#f5ff00` | 390 |

- La llamada parpadea: visible cuando `Math.floor(performance.now() / 500) % 2 === 0`.
- El título se dibuja dos veces: normal en `y = 250` y reflejado verticalmente con alfa 0,25 justo debajo, como guiño al tema.

### Efectos

| #   | Efecto               | Disparador               | Duración             | Parámetros                                                                                                                                                  |
| --- | -------------------- | ------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fondo de estrellas   | Siempre                  | Continuo             | 2 capas × 40 puntos de 1 px (capa 0) y 2 px (capa 1), color `#1f2a44` y `#33466e`. Se desplazan a `speed × 0.2` y `speed × 0.5`; reaparecen por la derecha. |
| 2   | Flechas de gravedad  | Siempre                  | Continuo             | Columnas de chevrons cada 80 px, alfa 0,08, color `#00ff88`. Apuntan y derivan a 60 px/s en la dirección de `gDir`. Al volcar cambian de sentido.           |
| 3   | Superficie activa    | Siempre                  | Continuo             | La línea de borde del lado hacia el que apunta `gDir` se dibuja con 3 px y `shadowBlur = 12`; la opuesta con 2 px y alfa 0,45.                              |
| 4   | Destello de vuelco   | Cada vuelco              | 0,15 s               | Rectángulo a pantalla completa `#00ff88` con alfa de 0,12 a 0.                                                                                              |
| 5   | Giro del cubo        | Cada vuelco              | Lo que dura el vuelo | `cubeAngle` interpola de 0 a π según la fracción recorrida entre superficies. Al aterrizar vuelve a 0. Solo afecta al dibujo; el AABB no rota.              |
| 6   | Estela               | Cubo en el aire          | 8 frames             | 8 copias del cubo en posiciones verticales previas, desplazadas 6 px a la izquierda cada una, alfa de 0,35 a 0, color `#00ff88`.                            |
| 7   | Aplastamiento        | Aterrizar                | 0,12 s               | Escala del cubo de `1.25 × 0.75` a `1 × 1`, anclada a la superficie de apoyo.                                                                               |
| 8   | Polvo de aterrizaje  | Aterrizar                | 0,3 s                | 6 partículas `#00ff88` desde el punto de contacto, velocidad 40–120 px/s alejándose de la superficie y hacia atrás.                                         |
| 9   | Estallido de chispa  | Recoger chispa           | 0,4 s                | 8 partículas `#f5ff00` radiales a 60–160 px/s.                                                                                                              |
| 10  | Texto de puntos      | Recoger chispa           | 0,6 s                | Texto `+50` … `+250` (el valor real sumado), `bold 16px monospace`, `#f5ff00`, sube 40 px en contra de `gDir` mientras se desvanece.                        |
| 11  | Racha máxima         | `streak >= 5`            | Mientras dure        | El texto `RACHA x5` del HUD interno late entre alfa 0,6 y 1 a 4 Hz.                                                                                         |
| 12  | Racha rota           | La racha pasa de ≥ 2 a 0 | 0,6 s                | Texto `RACHA ROTA`, `14px monospace`, `#ff006e`, en `(W - 14, 46)` alineado a la derecha.                                                                   |
| 13  | Cartel de nivel      | Sube el nivel            | 1,2 s                | Texto `NIVEL 02` (dos dígitos), `bold 28px monospace`, `#00f5ff`, centrado en `(400, 300)`, alfa 1 → 0. No se muestra en el nivel 1.                        |
| 14  | Aviso de barreras    | Se alcanza el nivel 3    | 1,2 s                | Bajo el cartel de nivel, `BARRERAS ACTIVAS`, `14px monospace`, `#ff006e`, en `y = 330`.                                                                     |
| 15  | Explosión del cubo   | Morir                    | 0,7 s                | 18 partículas `#e6e9ff` y `#00ff88` alternas, radiales a 80–260 px/s, desde el centro del cubo. Si murió por vacío, desde el borde del canvas.              |
| 16  | Sacudida de pantalla | Morir                    | 0,35 s               | `ctx.translate` aleatorio de hasta ±8 px que decae linealmente. Desactivada si `reducedMotion`.                                                             |

Reglas comunes:

- Las partículas no tienen gravedad propia salvo las del efecto 8, que aceleran a `gDir × 400 px/s²`.
- `particles` nunca supera `MAX_PARTICLES`; al llegar al tope se descartan las más antiguas.
- En `"gameover"` el loop sigue actualizando y dibujando partículas y sacudida, como hace `asteroides`; el resto del mundo queda congelado.
- En pausa no se actualiza ni se dibuja ningún efecto (regla de pausa de GJ-vuelco-01).
- Con `reducedMotion` se desactivan los efectos 4 y 16; el resto se mantiene.
- Todos los efectos se reinician en `initGame`.

### CSS del cover

Este spec no añade CSS. El cover `cover-vuelco` se define en GJ-vuelco-02.

---

## Plan de implementación

1. **Pantalla de inicio** — Añadir el estado `"ready"`, arrancar en él, dibujar los cuatro textos y pasar a `"playing"` con la primera pulsación sin volcar. Verificación: `/juego/vuelco/jugar` muestra el título y los controles; la puntuación no sube hasta pulsar; tras pulsar, el cubo empieza a correr por el suelo.

2. **Sistema de partículas y textos flotantes** — Añadir `Particle`, `FloatText`, sus arrays, su actualización, su dibujo y el tope `MAX_PARTICLES`. Sin disparadores todavía. Verificación: `npm run build` y `npm run lint` pasan; el juego se comporta igual que antes.

3. **Lectura de la gravedad** — Implementar los efectos 1, 2, 3 y 4 (estrellas, flechas, superficie activa, destello de vuelco). Verificación: al volcar, las flechas cambian de sentido y la superficie resaltada pasa al lado opuesto.

4. **Movimiento del cubo** — Implementar los efectos 5, 6, 7 y 8 (giro, estela, aplastamiento, polvo). Verificación: el cubo gira media vuelta en cada vuelco y se aplasta al aterrizar; las colisiones no cambian.

5. **Feedback de chispas y racha** — Implementar los efectos 9, 10, 11 y 12. Verificación: al recoger una chispa aparece el texto con el valor exacto sumado al score; al dejar pasar una con racha ≥ 2 aparece `RACHA ROTA`.

6. **Niveles y muerte** — Implementar los efectos 13, 14, 15 y 16, incluida la lectura de `prefers-reduced-motion`. Verificación: al llegar al nivel 2 aparece `NIVEL 02`; al morir se ve la explosión tras el modal; con "reducir movimiento" activo en el sistema no hay sacudida.

---

## Criterios de aceptación

- [ ] Al cargar `/juego/vuelco/jugar` se ve `VUELCO`, `ESPACIO / CLIC — VOLCAR LA GRAVEDAD` y `PULSA PARA EMPEZAR` parpadeando
- [ ] Antes de la primera pulsación el score se mantiene en 0 y el cubo no avanza
- [ ] La primera pulsación inicia la partida sin volcar la gravedad
- [ ] Tras "JUGAR DE NUEVO" vuelve a mostrarse la pantalla de inicio
- [ ] Las flechas de fondo apuntan hacia el suelo con gravedad normal y hacia el techo con gravedad invertida
- [ ] La línea de la superficie hacia la que cae el cubo se ve más brillante que la opuesta
- [ ] El cubo gira media vuelta durante cada vuelco y deja estela solo mientras está en el aire
- [ ] Al aterrizar el cubo se aplasta 0,12 s y suelta 6 partículas
- [ ] Al recoger una chispa aparecen 8 partículas amarillas y un texto con los puntos sumados
- [ ] Al subir de nivel aparece el cartel `NIVEL NN` durante 1,2 s
- [ ] Al llegar al nivel 3 aparece `BARRERAS ACTIVAS`
- [ ] Al morir hay explosión de 18 partículas y sacudida de 0,35 s
- [ ] Con `prefers-reduced-motion: reduce` no hay sacudida ni destello de vuelco
- [ ] Constantes de física, velocidad, generación y puntuación de GJ-vuelco-01 no han cambiado en `game.ts`
- [ ] `GameCallbacks`, `GameController` y la firma de `initGame` no han cambiado
- [ ] `components/games/vuelco/index.tsx` no ha cambiado
- [ ] Una partida con los mismos vuelcos puntúa lo mismo que antes de este spec
- [ ] En pausa no se mueve ningún efecto
- [ ] Tras 5 minutos de partida el array de partículas no supera 120 elementos
- [ ] Los juegos ya existentes (asteroides, tetris, arkanoid, snake) siguen funcionando sin cambios
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `npm run lint` pasa sin errores

---

## Decisiones

- **Sí: el pulido sirve para leer la gravedad.** Flechas de fondo, superficie activa y giro del cubo responden a una sola pregunta: hacia dónde cae el cubo ahora. Es la forma de que el tema se vea además de jugarse.
- **Sí: pantalla de inicio dentro del canvas.** `asteroides` arranca sin aviso; aquí el control es un solo botón poco habitual y conviene enseñarlo. Dentro del canvas no obliga a tocar `index.tsx`.
- **Sí: la primera pulsación no vuelca.** Así el estado inicial de la partida es idéntico al de GJ-vuelco-01 y no se altera ninguna regla.
- **No: retrasar `onGameOver` para mostrar la explosión.** Cambiaría el contrato del spec 01. La explosión se reproduce detrás del modal, como las partículas de `asteroides` en `gameover`.
- **Sí: el giro del cubo es solo visual.** Rotar el AABB cambiaría las colisiones, que pertenecen a GJ-vuelco-01.
- **Sí: mismo loop `requestAnimationFrame`.** Los efectos usan el `dt` del loop existente; no se añaden timers ni `setInterval`.
- **Sí: mismos callbacks (`onScore`, `onLevel`, `onGameOver`).** Ningún efecto necesita avisar a React.
- **Sí: slug, categoría, color y cover sin cambios.** `vuelco`, `ARCADE`, `green`, `cover-vuelco` vienen de GJ-vuelco-02; los efectos usan el mismo verde `#00ff88` como color de identidad.
- **No: cover nuevo en este spec.** Ya se definió en GJ-vuelco-02 porque la entrada de catálogo lo necesita desde el primer momento.
- **Sí: respetar `prefers-reduced-motion`.** La sacudida y el destello a pantalla completa son los dos efectos que pueden molestar; el resto es local y pequeño.
- **Sí: tope de 120 partículas.** A velocidad máxima hay un aterrizaje cada medio segundo; el tope evita crecimiento sin límite.
- **No: sonido.** Ningún juego escrito desde cero en la plataforma lo tiene y exigiría assets externos o síntesis, fuera del alcance del jam.
- **No: zoom o rotación de cámara al volcar.** Girar la pantalla 180° expresaría el tema, pero desorienta y dificulta leer los peligros a 620 px/s.

---

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Un efecto altera sin querer reglas o puntuación                          | Los efectos solo leen el estado de juego; criterio de aceptación de puntuación idéntica                       |
| El estado `"ready"` deja a `index.tsx` con PAUSA/FIN activos sin partida | PAUSA en `"ready"` solo congela el parpadeo; FIN abre el modal con score 0, igual que en cualquier otro juego |
| Caída de frames por `shadowBlur` y partículas                            | `shadowBlur` solo en una línea por frame; tope `MAX_PARTICLES = 120`; estrellas de 1–2 px sin sombra          |
| `ctx.translate` de la sacudida se acumula entre frames                   | Cada `draw` envuelve el mundo en `ctx.save()` / `ctx.restore()`                                               |
| Sacudida y destello molestan a usuarios sensibles al movimiento          | Se desactivan con `prefers-reduced-motion: reduce`                                                            |
| `matchMedia` no disponible en SSR                                        | Se lee dentro de `initGame`, que solo se ejecuta en cliente gracias a `{ ssr: false }`                        |
| Efectos de la partida anterior visibles tras "JUGAR DE NUEVO"            | `initGame` vacía `particles`, `floatTexts`, `trail` y pone a 0 todos los temporizadores                       |
| Los textos de la pantalla de inicio tapan el cubo o el pasillo           | Todos los textos se dibujan entre `y = 250` y `y = 390`; el cubo está en `y = 492`                            |
