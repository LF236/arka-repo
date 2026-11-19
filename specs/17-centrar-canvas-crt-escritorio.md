# SPEC 17 — Centrar el canvas en la pantalla CRT (escritorio)

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 09, SPEC 10, SPEC 13
> **Date:** 2026-11-19
> **Objetivo:** Centrar (horizontal y vertical, a tamaño nativo) el canvas dentro de `.crt-screen` en escritorio (≥1024px) mediante una regla global, para que Frogger, Arkanoid y Asteroides dejen de verse pegados a la izquierda.

---

## Por qué existe este spec

Reportado el 2026-11-19 al probar SPEC 16 (actualización de Next 16.4.6). Verificado que **no es regresión del upgrade**: `preflight.css` de Tailwind es idéntico entre 4.3.3 y 4.3.5 y `app/globals.css` no cambió.

Causa raíz (leída en el código, pendiente de confirmar visualmente en el paso 1):

- `.crt-screen` define `aspect-ratio: 4 / 3` y `overflow: hidden`, pero **ninguna regla de escritorio** posiciona ni dimensiona el `<canvas>` hijo. El canvas usa su tamaño intrínseco y queda en la esquina superior izquierda.
- La única regla `.crt-screen > canvas` (`app/globals.css`, ~línea 3783) vive dentro de `@media (max-width: 1023px)` (móvil, con `margin: 0 auto`).
- Frogger: `.crt` con `maxWidth: 848` → pantalla de ~800px de ancho; canvas de 640×560 deja ~160px vacíos a la derecha y, por su `aspectRatio: "640 / 560"`, también hueco abajo.
- Arkanoid y Asteroides: `.crt` sin `maxWidth` (ancho libre); si la pantalla es más ancha que el canvas, queda pegado a la izquierda.
- Snake (800×800, `aspectRatio: "1"`, `maxWidth: 848`) llena la pantalla, por eso no se ve el problema. Tetris usa `.tetris-stage` con 2 canvases propios.

Estructura actual: `.crt > .crt-screen > canvas` + overlays (`.crt-content`, pausa) con `position: absolute`.

---

## Scope

**In:**

- Una regla global en `app/globals.css`, dentro de `@media (min-width: 1024px)`, que centre el canvas dentro de `.crt-screen` a tamaño nativo (sin escalar), en ambos ejes.
- Medir y confirmar primero qué juegos están afectados (Frogger, Arkanoid, Asteroides, Snake, Tetris) y verificar los tres skins (clásico, neon, retro) en cada uno.
- Excluir de la regla lo que no deba cambiar (Tetris con sus 2 canvases) si la medición lo exige.
- Verificar que la capa móvil (<1024px) y los overlays (pausa, game over, `.crt-content`) no cambian.

**Out of scope (para specs futuros):**

- Escalar el canvas para llenar el CRT (`width: 100%` / `height: auto`). Riesgo en coordenadas de ratón (Arkanoid) y en rendimiento con glow (SPEC 13).
- Cambiar tamaños de canvas, `aspect-ratio` o `maxWidth` de cada juego.
- Rediseño del marco CRT, skins o gamepad móvil.
- Layout de Tetris (`.tetris-stage`).
- Cualquier cambio en lógica de juego, leaderboard o Supabase.

---

## Data model

Este spec no introduce datos ni estructuras nuevas. Solo CSS:

```css
@media (min-width: 1024px) {
  .crt-screen {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .crt-screen > canvas {
    flex: none; /* tamaño nativo, sin encoger ni estirar */
  }
}
```

Es la propuesta de partida; el paso 2 la ajusta si la medición muestra un efecto secundario (p. ej. overlays o `aspect-ratio`).

---

## Implementation plan

1. Rama `spec-17-centrar-canvas-crt-escritorio` (auto vía `/spec-impl`). Árbol limpio.
2. Medir con `npm run dev` + Playwright en ancho ≥1024px (capturas en `.playwright-screenshots/`): por cada juego (`asteroides`, `tetris`, `arkanoid`, `snake`, `frogger`), tamaño de `.crt-screen` vs. canvas y posición del canvas. Anotar cuáles están descentrados y en qué eje.
3. Añadir la regla global en `app/globals.css` dentro de `@media (min-width: 1024px)`, junto al bloque de `.crt-screen`. No tocar el media query móvil.
4. Si la medición del paso 2 muestra que algún juego no debe verse afectado (Tetris u otro), acotar el selector (p. ej. excluir con `:not(.tetris-stage)` o una clase) y anotarlo en Decisiones.
5. Re-medir los 5 juegos en los 3 skins en escritorio: canvas centrado en ambos ejes, sin recorte ni scroll nuevo.
6. Verificar que los overlays (pausa, game over, `.crt-content`) siguen cubriendo toda la pantalla y que Arkanoid mantiene el input de ratón.
7. Verificar móvil (<1024px) sin cambios (captura antes/después) y `crt-bottom`/`hud-actions` intactos.
8. `npm run build` y `npm run lint` sin errores ni warnings nuevos respecto a `main`. Marcar `Status: Implemented`.

---

## Acceptance criteria

- [x] En escritorio (≥1024px), el canvas de Frogger, Arkanoid y Asteroides queda centrado horizontal y verticalmente dentro de `.crt-screen`, en los 3 skins.
- [x] Snake se ve igual que antes del cambio.
- [x] Tetris se ve igual que antes del cambio (o, si se tocó, queda documentado en Decisiones).
- [x] El canvas mantiene su tamaño nativo (Frogger y Asteroides; Arkanoid conserva su escalado previo, ver Decisiones).
- [x] Overlays de pausa y game over cubren toda la pantalla CRT; el modal de game over funciona.
- [x] El paddle de Arkanoid responde al ratón sin desfase.
- [x] En <1024px (móvil) no hay cambios visuales ni de layout respecto a `main`.
- [x] La regla es global en `app/globals.css`: no hay estilos de centrado nuevos por juego.
- [x] `npm run build` exit 0 y `npm run lint` sin errores ni warnings nuevos (35 problemas preexistentes en `references/`, idénticos a `main`).
- [x] El diff toca solo `app/globals.css` (y, si la medición lo exige, algún `index.tsx` de juego) y el spec.

---

## Decisiones tomadas y descartadas

- **Sí:** regla global en `.crt-screen`. Cubre los juegos actuales y futuros; evita repetir el arreglo en cada `index.tsx`.
- **Sí:** centrar a tamaño nativo. Cero riesgo en input de ratón (Arkanoid) y en rendimiento (SPEC 13); el costo son posibles franjas negras laterales.
- **Sí:** flex en escritorio para centrar en ambos ejes (Frogger tiene hueco vertical por su `aspect-ratio`).
- **Sí:** incluir Asteroides aunque el reporte inicial fuera ambiguo (Asteroides/Arkanoid); la regla global los cubre a todos y el paso 2 lo confirma.
- **Sí (medición paso 2, 1440×900):** sin exclusiones. Tetris no se acota: sus canvases viven dentro de `.tetris-stage`, no son hijos directos de `.crt-screen`, así que `.crt-screen > canvas` no los alcanza (el efecto de `display: flex` en el contenedor se valida en el paso 5).
- **Nota (medición paso 2):** Arkanoid ya llenaba el CRT (canvas 800×600 escalado por CSS propio a 1004×753), no estaba descentrado. El criterio de "tamaño nativo" aplica solo a Frogger y Asteroides; Arkanoid conserva su escalado previo.
- **No:** escalar el canvas al ancho completo. Cambia dimensiones efectivas, afecta ratón y glow; merece su propio spec si se quiere.
- **No:** reglas por juego. Más código, más deriva.
- **No:** tocar el media query móvil. Ya centra con `margin: 0 auto`.

---

## Riesgos identificados

| Riesgo                                                                                    | Mitigación                                                                             |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `display: flex` en `.crt-screen` rompe overlays `position: absolute` o el `aspect-ratio`. | Pasos 5–6: verificación visual de overlays; ajustar o acotar el selector (paso 4).     |
| Tetris (2 canvases dentro de `.tetris-stage`) cambia de layout.                           | Medirlo en el paso 2 y excluirlo si cambia.                                            |
| Quedan franjas negras laterales/verticales que parecen un bug.                            | Aceptado en Decisiones; si molesta, spec futuro de escalado.                           |
| La causa raíz no es la supuesta (otra regla fija el tamaño del canvas).                   | Paso 2 mide antes de tocar CSS; si difiere, se actualiza el spec antes de implementar. |

---

## What is **not** in this spec

- Escalado del canvas a todo el ancho del CRT.
- Cambios de tamaño, proporción o `maxWidth` por juego.
- Layout de Tetris, skins, gamepad móvil, marco CRT.
- Tests automáticos o CI.

Cada uno, si se hace, va en su propio spec.
