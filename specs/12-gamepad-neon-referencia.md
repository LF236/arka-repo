# SPEC 12 — Rediseño del gamepad virtual según referencia MK-II

> **Status:** Implemented
> **Depends on:** SPEC 11
> **Date:** 2026-11-15
> **Objetivo:** Reemplazar el aspecto del gamepad virtual de móvil (`components/GamePad.tsx`) por el diseño "Gamepad MK-II" de `references/gamepad-assets/` (chasis neón, D-pad con gema, botones A/B esféricos), con acentos que siguen el skin activo y el pie PAUSA/FIN/SALIR integrado en el chasis.

---

## Por qué existe este spec

SPEC 11 entregó un gamepad funcional pero con estilo provisional (botones planos). La referencia `references/gamepad-assets/gamepad.html` (captura `gamepad-neon.png`) define el diseño final. Es un cambio **visual**: el contrato de props, la emisión de eventos de teclado y el layout de página de SPEC 11 no cambian.

---

## Scope

**In:**

- Reestilizar en `app/globals.css` las clases `gamepad`, `vp-*` replicando de la referencia:
  - Chasis: degradado `#1c1c28 → #0c0c14`, borde `--line`, radio 22px (16px bajo 620px), sombra neón exterior, borde interior a 4px (`::before`) y rejilla de puntos 8px (`::after`).
  - D-pad en cruz con 4 botones biselados (50px; 46px bajo 620px), flecha SVG triangular, hub central con gema rombo pulsante (`pulse-led`).
  - Botones A/B circulares (74px; 64px bajo 620px), brillo especular, letra `--pixel` con glow, anillo punteado (`.vp-ring`) visible al pulsar.
  - Orden y colocación: D-pad a la izquierda; B y A en horizontal a la derecha (B a la izquierda de A). Se elimina el desfase vertical actual de B (`margin-top: -28px`).
  - Estado pulsado: desplazamiento Y + glow del color de acento (equivalente a `.dp.on` / `.ab.on` de la referencia, resuelto con `:active` + pointer capture).
- Acentos por skin: `GamePad` lee `useSkin()` y pone `data-skin="<id>"` en la raíz; el CSS define variables `--pad-accent` (D-pad, gema, hub) , `--pad-a` y `--pad-b` por skin (`clasico`, `neon`, `retro`, `pastel`; skin sin variante → valores de `clasico`). El chasis queda siempre oscuro (legible en los 4).
- Flechas SVG en lugar de caracteres `↑↓←→`; `aria-label` se mantiene.
- Etiqueta de acción (`DISPARO`, `GIRAR`, `CAÍDA`) se conserva bajo la letra A/B (`<small>`).
- Pie PAUSA/REANUDAR · FIN · SALIR dentro del chasis, como fila inferior separada por una línea `--line`, con botones tipo píldora en el estilo del chasis (reemplaza las clases `btn yellow/magenta/ghost` actuales).
- Botones A/B no declarados, y ↑/↓ deshabilitados por `disableUp`/`disableDown`: aspecto apagado (opacidad 0.3, sin glow).
- Tamaños compactos bajo `max-height: 700px` (D-pad ≈ 120px, A/B ≈ 54px) para que 360×640 siga sin scroll.
- Reajustar `max-height` del canvas (`calc(100dvh - Npx)`) y `.tetris-stage` si la altura total del gamepad cambia.

**Out of scope (para specs futuros):**

- Cambios en `GamePadProps`, en la emisión de `KeyboardEvent`, auto-repeat o liberación de teclas.
- Mostrar el gamepad en escritorio (`lg+` sigue oculto) y resaltado del gamepad con teclado físico (existe en la referencia, aquí no aplica).
- Estados `:hover` de la referencia (pantallas táctiles).
- Importar `gamepad.html` o `gamepad-neon.png` (no se importa desde `references/`).
- D-pad continuo (deslizar entre flechas), háptica, sonido.
- Cambios en `game.ts`, skins de canvas, `lib/data.ts`, Supabase.
- Renombrar las clases `gp-*`/`dp`/`ab` del mockup existente en `globals.css` (siguen en uso por otra pantalla).

---

## Data model

Sin datos nuevos ni claves `localStorage`. `GamePadProps` no cambia. Único contrato nuevo, CSS:

| Variable CSS   | Uso                       | clasico   | neon      | retro     | pastel    |
| -------------- | ------------------------- | --------- | --------- | --------- | --------- |
| `--pad-accent` | D-pad pulsado, gema, glow | `#00ff88` | `#00f5ff` | `#ffb000` | `#8fd3ff` |
| `--pad-a`      | Botón A                   | `#ff00ff` | `#ff006e` | `#ff6a00` | `#ff9ecb` |
| `--pad-b`      | Botón B                   | `#00ff88` | `#00f5ff` | `#ffd34d` | `#8fd3ff` |

Valores iniciales tomados de las paletas de `skins.ts`; ajustables en implementación si el contraste es bajo, registrando el cambio aquí.

---

## Plan de implementación

1. **Variables y chasis** — En `globals.css`: variables `--pad-*` por `[data-skin]`; restilizar `.gamepad` (degradado, bordes, `::before`/`::after`, sombras). Verificación: `npm run build`; a 390px el contenedor se ve como la captura de referencia (vacío de contenido aún funcional).
2. **D-pad** — En `GamePad.tsx`: SVG por flecha y `.vp-hub` con `.vp-hub-gem`; en CSS cruz 156/144px con botones 50/46px y `@keyframes pulse-led`. Verificación: las 4 direcciones siguen emitiendo `keydown`/`keyup`; `disableUp`/`disableDown` se ven apagados.
3. **Botones A/B** — Markup `<span class="vp-ring">` + letra + `<small>` label; CSS esférico con variables `--pad-a`/`--pad-b`; B a la izquierda de A, alineados. Verificación: pulsar A/B muestra anillo y glow; botón no declarado queda apagado e inerte.
4. **Acentos por skin** — `useSkin()` en `GamePad`, `data-skin` en la raíz. Verificación: cambiar de skin en el selector cambia los acentos sin recargar.
5. **Pie integrado** — Fila PAUSA/REANUDAR, FIN, SALIR dentro del chasis con píldoras propias (`vp-pill`). Verificación: los 3 funcionan igual que en SPEC 11.
6. **Tamaños compactos y ajuste de canvas** — Media `(max-width: 1023px) and (max-height: 700px)` y retocar `max-height` del canvas / `.tetris-stage canvas` según la nueva altura. Verificación: capturas Playwright en `.playwright-screenshots/` a 390×844 y 360×640 con los 4 juegos y skins `clasico`, `neon`, `retro`.
7. **Verificación final** — `npm run build` y `npm run lint` pasan; partida corta por juego en emulación táctil (multitouch en asteroides, mantener ↓ en tetris); `lg+` sin cambios.

---

## Criterios de aceptación

- [X]El gamepad a 390×844 es visualmente equivalente a `gamepad-neon.png` (chasis, D-pad con gema, B y A esféricos horizontales) con skin `neon`.
- [X]Los acentos cambian con el skin (`clasico`, `neon`, `retro`) y el chasis sigue legible en todos.
- [X]La gema central pulsa; el anillo punteado aparece al pulsar A/B.
- [X]A/B conservan su etiqueta de acción; A/B no declarados y ↑/↓ deshabilitados se ven apagados y no emiten eventos.
- [X]PAUSA/REANUDAR, FIN y SALIR están dentro del chasis y funcionan como antes.
- [X]Multitouch (mover + disparar) y auto-repeat de SPEC 11 siguen funcionando; `GamePad.tsx` no cambia sus props ni la lógica de eventos.
- [X]A 390×844 y 360×640 no hay scroll horizontal ni vertical; canvas + gamepad caben.
- [X]Separación canvas–gamepad de 28px (20px en pantallas bajas) se mantiene.
- [X]A ≥1024px el gamepad sigue oculto y la página se ve igual.
- [X]Los 4 `game.ts` sin diff.
- [X]`npm run build` y `npm run lint` pasan.

---

## Decisiones

- **Sí: acentos que siguen el skin** — Pedido del usuario. Reemplaza la decisión de SPEC 11 de usar colores fijos del tema arcade. Chasis oscuro fijo para no perder contraste (también con pastel).
- **Sí: pie dentro del chasis como fila inferior** — La zona central de la referencia no existe a 360px (D-pad 144 + A/B 144 + padding ≈ todo el ancho). Descartado: botones en el centro entre D-pad y A/B.
- **Sí: conservar etiqueta bajo A/B** — Informa la acción por juego; la referencia solo muestra la letra.
- **Sí: decoración completa de la referencia (gema animada, anillo, rejilla, borde interior)** — Pedido literal "igual a". Descartado: versión sin animación.
- **Sí: prefijo `vp-*`** — `gp-*`, `dp`, `ab` ya los usa el mockup en `globals.css`; reutilizarlos colisionaría.
- **Sí: `:active` + pointer capture en vez de clase `.on` por JS** — El estado pulsado ya se mantiene mientras hay captura; evita estado React extra y re-renders.
- **No: copiar JS de la referencia** — Su teclado/pointer solo anima; la emisión real vive en `GamePad.tsx`.

---

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Chasis más alto desborda 360×640                                                 | Tamaños compactos bajo `max-height: 700px` y retoque del `max-height` del canvas (paso 6) |
| Objetivos táctiles < 44px en pantallas bajas                                     | Aceptado (SPEC 11 ya usaba 40px); se revisa en capturas                                   |
| `box-shadow`/`filter: drop-shadow` y animación infinita encarecen móviles viejos | Solo la gema anima (opacity/transform); glow vía `box-shadow`, sin blur en el canvas      |
| Hidratación: `useSkin()` devuelve `clasico` hasta leer `localStorage`            | Parpadeo de acento aceptado; el contenedor ya es cliente-only (`dynamic ssr:false`)       |
| Colores de `retro`/`pastel` con poco contraste sobre chasis oscuro               | Valores ajustables en implementación; verificar en capturas                               |
