# SPEC 02 — Home Page y Reubicación de Biblioteca

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-11-07
> **Objective:** Implementar la landing page (Home) en `/` usando el template `references/templates/home-about/home.jsx` y mover la Biblioteca actual de `/` a `/biblioteca`, actualizando el Nav.

---

## Scope

**In:**

- `app/page.tsx` — reemplazar con la Home page (landing)
- `app/biblioteca/page.tsx` — nuevo archivo con el contenido actual de `app/page.tsx` (Biblioteca + GameCard)
- `components/Nav.tsx` — agregar link "Inicio" → `/`, cambiar Biblioteca → `/biblioteca`, actualizar `isActive`
- Home page incluye todas las secciones del template:
  - Hero con `FloatingSilhouettes` (siluetas SVG flotantes) y eyebrow/título/subtítulo/CTAs/scroll hint
  - Sección "¿POR QUÉ ARCADE VAULT?" — `feature-grid` con 4 `FeatureIcon` SVG
  - Sección "JUEGOS DISPONIBLES AHORA" — mini-rail con los primeros 6 juegos de `GAMES`, clicables hacia `/juego/[id]`
  - Sección "ESTADÍSTICAS" — 3 stat-blocks hardcodeados
  - Sección "ACTIVIDAD EN VIVO":
    - Card "ÚLTIMAS PUNTUACIONES" — datos hardcodeados (incluyen nombre de juego y tiempo relativo)
    - Card "TOP JUGADORES · HOY" — datos generados con `seededScores(42, 5)`
  - Sección "PRECIOS" — price-card + FAQ hardcodeados
  - Sección "¿LISTO PARA JUGAR?" — CTA final
- Animación `.reveal` via `IntersectionObserver` en `useEffect`
- CSS: ya presente en `app/globals.css` desde SPEC 01 (migración completa de `references/templates/styles.css`)

**Out of scope:**

- About page (spec separado)
- Datos reales de actividad (backend/API)
- El link "Acerca de" del Nav queda sin ruta activa hasta el spec de About (se puede incluir el `<Link>` apuntando a `/acerca` como placeholder)
- Cambios en `lib/data.ts` o en la estructura de datos existente
- Tests automatizados

---

## Data model

No se introducen nuevas estructuras. Se reutilizan:

```ts
// Ya existentes en lib/data.ts
GAMES: Game[]          // para mini-rail (slice 0–6) y navegación
seededScores(seed, n)  // para top-5 de "TOP JUGADORES · HOY"
```

Datos hardcodeados en el componente (no en lib/data.ts):

```ts
// Constantes locales en app/page.tsx
const RECENT_SCORES = [
  { p: "NEONFOX",  g: "Caída",        s: 184220, t: "hace 2 min",  c: "magenta" },
  { p: "PX_KAI",   g: "Glotón",       s: 96400,  t: "hace 5 min",  c: "yellow"  },
  // ... 5 filas más (igual que el template)
]
```

---

## Implementation plan

1. **Verificar CSS en `app/globals.css`** — Confirmar que las reglas `.home`, `.home-hero`, `.home-silos`, `.home-section`, `.mini-rail`, `.mini-card`, `.home-stats`, `.home-final`, `.reveal`, `.about` y demás reglas de las páginas nuevas ya están presentes (vienen de la migración completa de `styles.css` en SPEC 01). Si falta alguna, añadirla. Verificación: `npm run dev` sin errores de CSS.

2. **Crear `app/biblioteca/page.tsx`** — Mover el contenido actual de `app/page.tsx` a este nuevo archivo sin modificar su lógica: `GameCard`, hook de filtrado, JSX de Biblioteca. Ajustar rutas de imports si es necesario. Verificación: `/biblioteca` muestra el hero "ARCADE VAULT", buscador, chips y grid de cards funcionales.

3. **Crear `app/page.tsx` (Home)** — Reemplazar con `'use client'`. Implementar:
   - `FloatingSilhouettes` — componente de siluetas SVG pixeladas (8 SVGs del template).
   - `FeatureIcon` — renders SVG por `kind` ("GAMEPAD", "FREE", "TROPHY", "ROCKET").
   - `MiniCard` — card pequeña con cover y meta, onClick navega a `/juego/[id]`.
   - `useReveal()` — hook con `IntersectionObserver` que añade clase `in` a elementos `.reveal`.
   - `Home` — componente principal con todas las secciones. Botones usan `useRouter()` para navegar a `/biblioteca`, `/auth`, `/salon`.
   - La card "TOP JUGADORES · HOY" usa `seededScores(42, 5)` para los 5 jugadores.
   - La card "ÚLTIMAS PUNTUACIONES" usa el array `RECENT_SCORES` hardcodeado localmente.
   Verificación: `/` muestra el hero "EL ARCADE CLÁSICO ESTÁ DE VUELTA" con siluetas animadas; scroll revela secciones.

4. **Actualizar `components/Nav.tsx`** — Cambios mínimos:
   - Agregar link "Inicio" → `/` (con `Link` de `next/link` o `useRouter().push('/')`)
   - Cambiar link Biblioteca de `/` a `/biblioteca`
   - Actualizar `isActive`: Inicio activo en `/`; Biblioteca activo en `/biblioteca` y `/juego/*` (usar `usePathname().startsWith('/biblioteca') || usePathname().startsWith('/juego')`)
   - Agregar link "Acerca de" → `/acerca` (placeholder, sin página aún; no afecta funcionalidad)
   - Mismo cambio en el panel móvil.
   Verificación: los 4 links del Nav funcionan; el link activo cambia correctamente al navegar.

---

## Acceptance criteria

- [X] `/` muestra la landing Home con título "EL ARCADE CLÁSICO ESTÁ DE VUELTA" y el eyebrow "▸ INSERTA UNA MONEDA_"
- [X] Las siluetas SVG flotantes (8 formas pixel art) son visibles en el hero y tienen animación `float`
- [X] El botón "EXPLORAR JUEGOS" navega a `/biblioteca`
- [X] El botón "CREAR CUENTA" navega a `/auth`
- [X] La sección de juegos muestra exactamente los primeros 6 items de `GAMES` como mini-cards clicables
- [X] Click en una mini-card navega a `/juego/[id]` correspondiente
- [X] El botón "VER TODOS LOS JUEGOS →" navega a `/biblioteca`
- [X] La sección "TOP JUGADORES · HOY" muestra 5 filas con datos de `seededScores(42, 5)` (nombre y score)
- [X] El botón "VER SALÓN →" navega a `/salon`
- [X] Las secciones con `.reveal` tienen opacidad 0 al cargar y se revelan con animación al hacer scroll
- [X] El botón "EMPEZAR GRATIS" navega a `/auth`
- [X] El botón "INSERTAR MONEDA →" del final navega a `/biblioteca`
- [X] `/biblioteca` muestra la Biblioteca completa (hero "ARCADE VAULT", buscador, chips, 8 cards de juegos)
- [X] Los filtros de `/biblioteca` siguen funcionando (búsqueda + categoría)
- [X] El Nav tiene los links: "Inicio", "Biblioteca", "Salón de la Fama", "Acerca de" (placeholder)
- [X] El link "Inicio" en el Nav está activo (clase `active`) al estar en `/`
- [X] El link "Biblioteca" en el Nav está activo al estar en `/biblioteca` o en `/juego/*`
- [X] `npm run build` completa sin errores TypeScript
- [X] `npm run lint` pasa sin errores

---

## Decisions

- **Sí: Biblioteca mueve a `/biblioteca`** — libera `/` para la Home, coherente con la estructura del Nav del template que tiene "Inicio" y "Biblioteca" como links separados.
- **Sí: `seededScores` para top jugadores** — consistente con el patrón ya establecido en `/salon`. Se usa seed `42` y `count=5`.
- **Sí: `RECENT_SCORES` hardcodeado** — la estructura de "últimas puntuaciones" incluye nombre de juego y tiempo relativo ("hace 2 min"), que `seededScores` no provee. Hardcodear es lo más fiel al template sin complicar `lib/data.ts`.
- **Sí: CSS ya presente** — SPEC 01 migró el archivo `styles.css` completo (1745 líneas); el CSS de Home/About (`.home-*`, `.reveal`, `.about-*`) ya debe estar en `globals.css`. Se verifica en el paso 1 y se añade solo lo que falte.
- **Sí: link "Acerca de" como placeholder** — el Nav del template ya lo incluye. Se añade apuntando a `/acerca` sin que eso rompa nada.
- **No: Home en ruta distinta de `/`** — rompe el UX del template donde el logo siempre lleva al home.

---

## Risks

| Riesgo | Mitigación |
|--------|------------|
| CSS del Home no fue migrado completo en SPEC 01 (posible truncamiento de archivo) | El paso 1 del plan verifica explícitamente su presencia antes de continuar |
| Links en Nav que apuntan a `/` pueden romper si la Biblioteca se mueve pero los links en Detalle/Reproductor no se actualizan | Revisar en paso 4 que los botones de Biblioteca en `/juego/[id]` y `/juego/[id]/jugar` apunten a `/biblioteca` |
| `useReveal` y `IntersectionObserver` requieren `'use client'` y no funcionan en SSR | La Home es Client Component (`'use client'`); no hay issue |
