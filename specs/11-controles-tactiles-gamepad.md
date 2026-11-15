# SPEC 11 — Controles táctiles: gamepad virtual para móvil

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07, SPEC 09, SPEC 10
> **Date:** 2026-11-15
> **Objetivo:** Hacer jugables los 4 juegos canvas en pantallas táctiles bajo el breakpoint `lg` de Tailwind, con el canvas arriba y un gamepad virtual (D-pad + 2 botones) abajo.

---

## Por qué existe este spec

Hoy los juegos solo leen teclado (y mouse en arkanoid): en móvil no hay forma de jugarlos. Los 4 juegos escuchan `keydown`/`keyup` en `window`/`document`, así que un gamepad que emita eventos de teclado sintéticos funciona sin tocar la lógica de ningún `game.ts`, y cualquier juego futuro lo hereda con solo montar el componente.

---

## Scope

**In:**

- `components/GamePad.tsx` — componente cliente reutilizable: D-pad (↑ ↓ ← →), botones A y B, y fila de pie con PAUSA/REANUDAR, FIN y SALIR.
- Emisión de `KeyboardEvent` sintéticos (`keydown` / `keyup`) con `key` **y** `code` en `document` (burbujean a `window`).
- Auto-repeat mientras un botón se mantiene pulsado (emula la repetición del SO) para los juegos que actúan solo en `keydown` (tetris, snake).
- Mapeo A/B declarado por juego mediante props (`a`, `b` con `{ label, key, code }`); botón no declarado se muestra deshabilitado.
- Integración en los 4 `components/games/<slug>/index.tsx` (asteroides, tetris, arkanoid, snake).
- Layout bajo `lg` (< 1024px): columna — HUD de stats, canvas escalado al ancho disponible, gamepad al pie. `lg+` queda igual que hoy (gamepad oculto con `lg:hidden`).
- Canvas escalado por CSS (resolución interna intacta), proporción fija por juego.
- Bajo `lg`, los botones PAUSA/FIN/SALIR del `hud-actions` se ocultan y viven en el pie del gamepad; el HUD conserva Jugador y Puntuación (y vidas/nivel/líneas donde existan).
- CSS del gamepad en `app/globals.css` (clases `gamepad`, `vp-*`; el prefijo `gp-*` ya lo usa el mockup de referencia), legible con los skins existentes (usa variables CSS del tema).
- Bajo `lg`, en `/juego/[id]/jugar` la navbar global se oculta (más espacio vertical).
- Bajo `lg`, botón REGRESAR (→ `/biblioteca`) en la fila del selector de TEMA de cada juego.
- Separación de 28px (20px en pantallas bajas) entre el canvas y el gamepad.
- Props opcionales `over` (libera teclas en game over), `disableDown` (usado en asteroides y arkanoid, que no leen `ArrowDown`) y `disableUp` (usado en arkanoid, que no lee `ArrowUp`) en `GamePadProps`.

**Out of scope (para specs futuros):**

- Juegos nuevos que requieran otro esquema de controles (se especifica en su propio spec).
- Arrastre táctil / `touchmove` sobre el canvas (arkanoid mueve la paleta solo con ←/→ en móvil).
- Joystick analógico, diagonales simultáneas dedicadas, más de 2 botones de acción.
- Vibración háptica y sonido.
- Forzar orientación (`screen.orientation.lock`) ni modo pantalla completa.
- Cambios en `lib/data.ts`, Supabase, `/salon` o `/juego/[id]`.
- Cambios en la lógica de `game.ts` de los juegos existentes.
- Selector de skin: permanece donde está.

---

## Data model

No introduce datos persistentes ni claves `localStorage` nuevas. Solo un contrato de props:

```ts
// components/GamePad.tsx
export interface PadButton {
  label: string; // texto del botón, ej. "DISPARO"
  key: string; // KeyboardEvent.key, ej. " "
  code: string; // KeyboardEvent.code, ej. "Space"
}

export interface GamePadProps {
  a?: PadButton;
  b?: PadButton;
  paused: boolean;
  over?: boolean; // libera teclas en game over
  disableDown?: boolean; // deshabilita ↓ (juegos que no lo usan)
  disableUp?: boolean; // deshabilita ↑ (juegos que no lo usan)
  onTogglePause: () => void;
  onEnd: () => void;
  exitHref: string; // `/juego/${gameId}`
}
```

D-pad fijo (no configurable):

| Botón | `key`        | `code`       |
| ----- | ------------ | ------------ |
| ↑     | `ArrowUp`    | `ArrowUp`    |
| ↓     | `ArrowDown`  | `ArrowDown`  |
| ←     | `ArrowLeft`  | `ArrowLeft`  |
| →     | `ArrowRight` | `ArrowRight` |

Mapeo A/B por juego:

| Juego      | A                           | B                 | D-pad efectivo                  |
| ---------- | --------------------------- | ----------------- | ------------------------------- |
| asteroides | `Space` — DISPARO           | — (deshabilitado) | ←/→ rotar, ↑ empuje, ↓ deshabilitado (`disableDown`) |
| tetris     | `Space` — CAÍDA (hard drop) | `KeyX` — GIRAR    | ←/→ mover, ↓ soft drop, ↑ girar |
| arkanoid   | — (deshabilitado)           | — (deshabilitado) | ←/→ paleta, ↑/↓ deshabilitados (`disableUp`, `disableDown`) |
| snake      | — (deshabilitado)           | — (deshabilitado) | 4 direcciones                   |

Comportamiento de eventos:

- `pointerdown` → `keydown` inmediato; tras 170 ms de retención, `keydown` con `repeat: true` cada 50 ms.
- `pointerup` / `pointercancel` / `pointerleave` → `keyup` y limpieza del timer.
- Al desmontar, al perder foco de ventana (`blur`) y al pasar a pausa/game over: `keyup` de todo lo pulsado.
- `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `contextmenu` prevenido en el gamepad; `setPointerCapture` para multitouch fiable (mover + disparar a la vez).

---

## Plan de implementación

1. **CSS base responsive** — En `app/globals.css`: bajo `lg` (`@media (max-width: 1023px)`), `.crt` con padding reducido (≈8px) y `border-radius` menor; `.crt-screen canvas` con `width: 100%; height: auto`; `.av-player` en columna con padding 16px. Clases `.gamepad`, `.gp-dpad`, `.gp-btn`, `.gp-action`, `.gp-foot`; `.gamepad { display: none }` desde `lg`. Verificación: `npm run build`; en DevTools a 390px los juegos existentes se ven escalados sin scroll horizontal.
2. **Crear `components/GamePad.tsx`** — Implementar D-pad, A/B y pie (PAUSA/REANUDAR, FIN, SALIR) con pointer events, auto-repeat y liberación de teclas según Data model. Verificación: TypeScript compila; `npm run lint` pasa; en un montaje de prueba, pulsar ← dispara `keydown`/`keyup` observables en `document`.
3. **Integrar en snake** — Montar `<GamePad>` bajo `.crt` en `components/games/snake/index.tsx`; ocultar `hud-actions` bajo `lg` (`max-lg:hidden`); sin A/B. Verificación: en emulación móvil, las 4 direcciones mueven la serpiente, PAUSA congela, SALIR navega.
4. **Integrar en tetris** — `a: Space/CAÍDA`, `b: KeyX/GIRAR`. Verificación: mover, soft drop (mantener ↓ repite), girar y hard drop funcionan.
5. **Integrar en arkanoid** — Sin A/B. Verificación: mantener ←/→ mueve la paleta de forma continua; `mousemove` en escritorio sigue funcionando.
6. **Integrar en asteroides** — `a: Space/DISPARO`. Verificación: rotar + empujar + disparar simultáneamente (multitouch) funciona.
7. **Ajustar alto de canvas en móvil** — Limitar el alto del canvas (`max-height` basado en `100dvh` menos HUD y gamepad) manteniendo proporción, de modo que canvas + gamepad + pie quepan sin scroll en 390×844 y 360×640. Verificación: captura Playwright a ambos tamaños en `.playwright-screenshots/`.
7b. **Navbar y REGRESAR en móvil** — Ocultar la navbar bajo `lg` en `/juego/[id]/jugar` (clase condicionada por `usePathname` en `Nav`, CSS en `globals.css`). Añadir `<Link href="/biblioteca">REGRESAR</Link>` (visible solo bajo `lg`) en la fila `.skin-selector` de los 4 juegos. Verificación: a 360×640 canvas + gamepad caben sin scroll; REGRESAR navega a `/biblioteca`; a ≥1024px navbar y fila de tema quedan como hoy.
8. **Verificación final** — `npm run build` y `npm run lint` pasan; a ≥1024px los 4 juegos se ven y juegan igual que antes (sin gamepad); bajo 1024px, jugar una partida completa por juego hasta game over y guardar score; modal de game over usable en móvil.

---

## Criterios de aceptación

- [X]`components/GamePad.tsx` existe y es reutilizable por cualquier juego mediante `GamePadProps`.
- [X]El gamepad es visible a <1024px (`lg`) y oculto a ≥1024px.
- [X]Los 4 `game.ts` no tienen cambios de lógica (el diff de `game.ts` es vacío).
- [X]Snake: las 4 direcciones del D-pad controlan la serpiente.
- [X]Tetris: ←/→ mueven, ↓ baja (repite al mantener), ↑ y B giran, A hace hard drop.
- [X]Arkanoid: ←/→ mueven la paleta de forma continua al mantener; el mouse sigue funcionando en escritorio.
- [X]Asteroides: ←/→ rotan, ↑ empuja, A dispara; se pueden pulsar dos botones a la vez.
- [X]Botones A/B no declarados por un juego aparecen deshabilitados.
- [X]Soltar el dedo, cancelar el toque, pausar, game over o desmontar libera todas las teclas (sin movimiento "pegado").
- [X]Tocar el gamepad no hace scroll de página ni zoom por doble toque.
- [X]Bajo `lg`, PAUSA/REANUDAR, FIN y SALIR están en el pie del gamepad y funcionan; `hud-actions` no se duplica.
- [X]El canvas escala al ancho disponible sin cambiar su resolución interna ni su proporción.
- [X]A 390×844 y 360×640 no hay scroll horizontal y canvas + gamepad caben en pantalla sin scroll vertical.
- [X]El gamepad es legible con los skins `clasico`, `neon` y `retro`.
- [X]Bajo `lg`, en `/juego/[id]/jugar` no se ve la navbar; a ≥1024px sí.
- [X]Bajo `lg`, REGRESAR junto al selector de TEMA navega a `/biblioteca`; a ≥1024px no se muestra.
- [X]Hay separación visible (28px) entre el canvas y el gamepad.
- [X]El modal de game over (input de nombre, guardar, jugar de nuevo) es utilizable en móvil.
- [X]`npm run build` y `npm run lint` pasan sin errores.

---

## Decisiones

- **Sí: eventos de teclado sintéticos** — Cero cambios en los 4 `game.ts`, preserva el contrato `{ pause, resume, destroy }` y los juegos futuros lo heredan montando `<GamePad>`. Descartado: método `input()` en `GameController` (toca todos los juegos y rompe el contrato).
- **Sí: `key` y `code` en cada evento** — Arkanoid lee `e.key`; tetris, snake y asteroides leen `e.code`. Ambos deben coincidir.
- **Sí: auto-repeat emulado** — Tetris y snake actúan solo en `keydown`; sin repetición, mantener ↓ o ← no tendría efecto continuo como en teclado.
- **Sí: D-pad de 4 direcciones + A/B por juego, botones sin uso deshabilitados** — Mantiene un diseño homologado entre juegos (pedido del usuario) sin inventar acciones donde no existen. Descartado: A/B genéricos fijos (botones muertos).
- **Sí: breakpoint `lg` (<1024px)** — Cubre móviles y tablets con layout en columna. Descartado: `md` (tablets verticales sin control) y `pointer: coarse` (el usuario pidió breakpoint estándar de Tailwind).
- **Sí: PAUSA/FIN/SALIR en el pie bajo `lg`** — El HUD propio del juego se mantiene; las acciones pasan al pie como pidió el usuario y se evita duplicarlas.
- **Sí: escalado CSS del canvas** — No toca resolución interna ni lógica de colisiones. Descartado: arrastre táctil en arkanoid (fuera de lo pedido; se puede especificar después).
- **Sí: mismo componente para todos** — Tamaño adaptado a móvil; el diseño visual sigue la imagen de referencia del gamepad (D-pad a la izquierda, botones de acción a la derecha).
- **No: nuevos juegos** — Los que requieran otros controles tendrán su propio spec.

---

## Riesgos

| Riesgo                                                              | Mitigación                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Teclas "pegadas" si el toque se cancela o la app pierde foco        | `pointercancel`, `blur`, pausa, game over y cleanup del `useEffect` liberan todas las teclas       |
| Un listener en `window` vs `document` no recibe el evento sintético | Se despacha en `document` con `bubbles: true`; llega a ambos                                       |
| Zoom/scroll accidental del navegador al tocar rápido                | `touch-action: none` + `user-select: none` + `preventDefault` en el gamepad                        |
| Canvas + gamepad no caben en pantallas bajas (360×640)              | Paso 7: `max-height` con `100dvh` y verificación en dos tamaños                                    |
| Deslizar el dedo del D-pad a otra flecha no cambia de dirección     | Aceptado en esta versión (botones independientes con captura); se evalúa un D-pad continuo después |
| Skins con fondos claros (pastel) reducen contraste del gamepad      | El gamepad usa variables del tema arcade oscuro, no los colores del skin del canvas                |
