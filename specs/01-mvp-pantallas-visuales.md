# SPEC 01 — MVP Pantallas Visuales

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-11-05
> **Objective:** Implementar las cinco pantallas visuales de Arcade Vault (Biblioteca, Detalle, Reproductor, Auth, Salón de la Fama) como páginas Next.js 16 con App Router, sin lógica de juego real.

---

## Scope

**In:**

- Pantalla Biblioteca (`/`) — hero, buscador, chips de categoría, grid de cards con tilt 3D
- Pantalla Detalle (`/juego/[id]`) — cover, info, stat-strip, leaderboard con datos mock
- Pantalla Reproductor (`/juego/[id]/jugar`) — HUD, pantalla CRT decorativa con animaciones, modal "Fin del juego"
- Pantalla Auth (`/auth`) — tabs "Iniciar Sesión" / "Crear Cuenta", formulario, "Jugar como invitado"
- Pantalla Salón de la Fama (`/salon`) — pódium top 3, tabla con tabs por juego, fila del usuario logueado
- Navbar sticky con menú hamburguesa para móvil
- CSS del template migrado tal cual a `app/globals.css`
- Fuentes Google Fonts (Press Start 2P, JetBrains Mono, Courier Prime) vía CDN en el layout
- Datos mock en `lib/data.ts` (GAMES, CATS, PLAYERS, seededScores)
- UserContext en `components/UserContext.tsx` para compartir sesión entre páginas (localStorage)
- Fondo animado (`.av-bg`, `.av-noise`) en el layout root

**Out of scope (para specs futuros):**

- Lógica de juego real en ninguna pantalla
- Backend, API routes o base de datos
- Autenticación real (OAuth, JWT, sesiones de servidor)
- Persistencia de puntuaciones en servidor
- Scores reales del usuario logueado (se usan datos seeded)
- Tests automatizados

---

## Data model

```ts
// lib/data.ts

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;        // clase CSS: "cover-bricks", "cover-tetro", etc.
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;         // "DD/MM/YYYY"
}

export interface User {
  name: string;         // máx 10 chars, uppercase
}

// Constantes: GAMES: Game[], CATS: string[], PLAYERS: string[]
// Función: seededScores(seed: number, count?: number): ScoreRow[]
```

El contexto de usuario vive en `components/UserContext.tsx`:

```ts
interface UserContextValue {
  user: User | null;
  login: (u: User) => void;
  signOut: () => void;
}
// Clave de localStorage: "av_user"
```

---

## Implementation plan

1. **`lib/data.ts`** — Crear con los tipos `Game`, `ScoreRow`, `User`, las constantes `GAMES`, `CATS`, `PLAYERS` y la función `seededScores`. Verificación: `tsc --noEmit` sin errores.

2. **`app/globals.css`** — Añadir el CSS del template (`references/templates/styles.css`) al final del archivo existente, respetando las variables de Tailwind v4 ya presentes. Verificación: `npm run dev` arranca sin errores de CSS.

3. **`components/UserContext.tsx`** — Crear el contexto React con `'use client'`, `UserProvider` que lee/escribe `av_user` en localStorage, y el hook `useUser()`. Verificación: el archivo compila sin errores TS.

4. **`app/layout.tsx`** — Modificar para: (a) añadir los `<link>` CDN de Google Fonts en el `<head>`, (b) renderizar `<div className="av-bg" />` y `<div className="av-noise" />` antes del `<body>`, (c) envolver children en `<UserProvider>`, (d) incluir `<Nav />` sobre el `<main>`. Verificación: `npm run dev`, se ve el fondo y el nav en todas las rutas.

5. **`components/Nav.tsx`** — Crear con `'use client'`. Lógica de menú hamburguesa, estado `open`, `isActive` según `usePathname()`. Usa `useUser()` para mostrar nombre/botón. Verificación: el nav se muestra correctamente en desktop y móvil.

6. **`app/page.tsx`** — Reemplazar con la pantalla Biblioteca (`'use client'`). Buscador con `useState`, chips de categoría, `useMemo` para filtrar `GAMES`, grid de `GameCard` con tilt 3D. Click en card navega a `/juego/[id]` via `useRouter()`. Verificación: filtros funcionan, click en card navega.

7. **`app/auth/page.tsx`** — Crear con `'use client'`. Tabs "in"/"up", formulario, botón "Jugar como invitado". Al submit llama `login()` del UserContext y hace `router.push("/")`. Verificación: al iniciar sesión el nav muestra el nombre del usuario.

8. **`app/salon/page.tsx`** — Crear con `'use client'`. Tabs por juego (chips), pódium top 3, tabla con animación `rise`, fila "YOU" si hay usuario. Usa `seededScores`. Verificación: cambiar tab actualiza datos, fila amarilla aparece si hay usuario.

9. **`app/juego/[id]/page.tsx`** — Crear con `'use client'`. Recibe `params.id`, busca el juego en `GAMES`. Si no existe, `notFound()`. Renderiza cover, info, stat-strip, leaderboard. Botón "JUGAR AHORA" navega a `/juego/[id]/jugar`. Verificación: cada juego muestra su cover correcto.

10. **`app/juego/[id]/jugar/page.tsx`** — Crear con `'use client'`. HUD con score/vidas/nivel (incrementan via `setInterval`). Pantalla CRT con la arena animada (nave, enemigos, piso en perspectiva). Overlay de pausa. Modal "Fin del juego" al pulsar "FIN", con input de nombre y botón guardar (escribe `av_scores` en localStorage). Verificación: pausa/reanuda, modal aparece, se puede guardar score.

---

## Acceptance criteria

- [ ] `npm run dev` arranca sin errores en consola
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `/` muestra hero "ARCADE VAULT", buscador, 5 chips de categoría y 8 cards de juegos
- [ ] Los chips filtran las cards por categoría; el buscador filtra por nombre
- [ ] Hacer click en una card navega a `/juego/[id]` con el cover y datos correctos
- [ ] `/juego/[id]` muestra el stat-strip (Partidas, Mejor global, Dificultad) y el leaderboard con 10 filas
- [ ] Botón "JUGAR AHORA" en `/juego/[id]` navega a `/juego/[id]/jugar`
- [ ] `/juego/[id]/jugar` muestra el HUD y la pantalla CRT con animaciones en marcha
- [ ] Pulsar "PAUSA" congela el score y muestra el overlay "EN PAUSA"; "REANUDAR" lo reactiva
- [ ] Pulsar "FIN" muestra el modal "FIN DEL JUEGO" con la puntuación final
- [ ] En el modal, guardar una puntuación escribe en localStorage `av_scores` y muestra "PUNTUACIÓN GUARDADA_"
- [ ] `/auth` muestra las dos tabs; al hacer submit navega a `/` y el Nav muestra el nombre del usuario
- [ ] Botón "JUGAR COMO INVITADO" cierra el Auth y vuelve a `/`
- [ ] `/salon` muestra el pódium y la tabla; cambiar la tab de juego actualiza los datos
- [ ] Si hay usuario logueado, `/salon` muestra la fila amarilla con su nombre
- [ ] El Nav es sticky; en viewport <840px aparece el hamburger y el panel lateral se abre/cierra
- [ ] `npm run lint` pasa sin errores

---

## Decisions

- **Sí: URL paths reales** (`/`, `/juego/[id]`, etc.) en lugar de hash routing — más idiomático en App Router y permite navegación nativa del browser.
- **Sí: CSS global** — el CSS del template (~950 líneas) se migra tal cual a `app/globals.css`. Reescribirlo en Tailwind v4 no aporta valor en este MVP y aumentaría el riesgo de divergencia visual.
- **Sí: CDN de Google Fonts** — decisión del usuario; las tres fuentes (Press Start 2P, JetBrains Mono, Courier Prime) se cargan vía `<link>` en el layout.
- **Sí: UserContext** — las páginas del App Router son componentes independientes; necesitan un mecanismo de estado compartido. Se eligió Context sobre prop drilling porque no hay árbol de componentes común más allá del layout.
- **Sí: todas las páginas como Client Components** (`'use client'`) — usan `useState`, `useEffect`, `localStorage`. No hay beneficio de SSR para datos completamente mock.
- **No: `next/font/google`** — el usuario prefirió mantener el CDN.
- **No: API routes** — sin backend en este spec; todos los datos vienen de `lib/data.ts` en el cliente.
- **No: juegos reales** — el reproductor es puramente decorativo (CRT con animaciones CSS/JS).

---

## Risks

| Riesgo | Mitigación |
|--------|-----------|
| Next.js 16 tiene breaking changes en la API (`LayoutProps`, etc.) | Leer los docs relevantes en `node_modules/next/dist/docs/` antes de implementar cada archivo |
| Variables CSS del template pueden colisionar con las de Tailwind v4 | Revisar los prefijos; las variables del template usan nombres cortos (`--bg`, `--cyan`) — confirmar que no hay solapamiento con Tailwind antes del paso 2 |

---

## Lo que **no** está en este spec

- Juegos reales funcionales (cada juego podría ser su propio spec).
- Autenticación real con proveedor externo.
- Backend y persistencia de scores en servidor.
- Sistema de créditos real.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
