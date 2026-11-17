# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault — plataforma online para jugar y competir por puntos. Juegos canvas reales (Asteroides, Tetris, Arkanoid, Snake, Frogger) con leaderboard en Supabase; el resto del catálogo son entradas mock.

Idioma del proyecto: español (UI, specs, commits de spec).

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run lint     # ESLint
```

No test suite configured. Verificación = `npm run build` + `npm run lint` + prueba manual en navegador.

Hook `PostToolUse` (`.claude/settings.json`) corre `prettier --write` y `eslint --fix` sobre cada archivo tras `Write`/`Edit` — no formatear a mano.

## Workflow: Spec Driven Design

Todo cambio funcional pasa por un spec en `specs/NN-slug.md` (estructura en `.claude/skills/spec/template.md`).

### Skills (`.claude/skills/<nombre>/SKILL.md`)

| Skill             | Uso                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `/spec`           | Diseña un spec nuevo. No escribe código.                                                       |
| `/spec-impl`      | Implementa un spec aprobado. Crea la rama `spec-NN-slug` (auto, ver `specs/.spec-config.yml`). |
| `/add-game`       | Genera el spec combinado juego + leaderboard. Solo spec; luego `/spec-impl`.                   |
| `/spec-impl-game` | `/spec-impl` + al terminar lanza `skin-designer` → `mobile-porter`. Flujo: `/add-game` → este. |

- `/spec` y `/spec-impl` vienen de `Klerith/fernando-skills` (fuente en `.agents/skills/`, symlinks en `.claude/skills/`, versiones en `skills-lock.json`). No editarlos a mano.
- `/add-game` y `/spec-impl-game` son locales.

### Agentes (`.claude/agents/<nombre>.md` — ahí está la definición completa)

Todos sin preguntas ni commits; los de `model: sonnet` corren en Sonnet.

- `game-planner` — sugiere/prioriza el próximo juego; anota en `references/games-suggestions-todo.md`. Memoria en `.claude/agent-memory/game-planner/`.
- `game-jam` — dado un tema, inventa un juego y escribe 2–3 specs `Borrador` en `specs/game-jam/<game-id>/`. Solo specs.
- `skin-designer` — implementa skins (clásico/neon/retro) en un juego; actualiza `references/game-with-themes.md`.
- `mobile-porter` — porta a móvil un juego nuevo (`<GamePad>`, SPEC 11).
- `game-performance-booster` — audita y arregla rendimiento de un juego (SPEC 13).

Flujos: `game-planner` → `/add-game` → `/spec-impl-game`; `game-jam` → promover spec a `specs/NN-slug.md` → `/spec-impl`.

Un spec = una rama `spec-NN-slug` = un PR a `main`. Al terminar, `Status: Implemented` en el spec.

## Architecture

Next.js 16 App Router con React 19 y TypeScript strict.

- `@/*` path alias → raíz del repo.
- Tailwind CSS v4 vía `@tailwindcss/turbopack` (no PostCSS — no añadir postcss config). Estilos globales y clases del tema arcade (`btn`, `crt`, `av-player`, `cover-*`…) en `app/globals.css`.
- Turbopack es el bundler; `next.config.ts` lo configura directamente.

### Rutas (`app/`)

| Ruta                   | Contenido                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `/`                    | Home                                                                                     |
| `/biblioteca`          | Catálogo de juegos                                                                       |
| `/juego/[id]`          | Ficha del juego + leaderboard lateral                                                    |
| `/juego/[id]/jugar`    | Reproductor: juego canvas si está en `CANVAS_GAMES`, si no player mock                   |
| `/juego/<slug>/jugar`  | Rutas estáticas por juego (arkanoid, frogger, snake, tetris; asteroides usa la dinámica) |
| `/salon`               | Salón de la fama (leaderboard global + tab por juego)                                    |
| `/acerca`              | About + formulario de contacto                                                           |
| `/auth`                | Login/registro (Supabase Auth: email, Google, GitHub) + recuperar contraseña             |
| `/auth/callback`       | GET → `exchangeCodeForSession`, redirige a `next` (solo rutas `/…`)                      |
| `/auth/reset-password` | Nueva contraseña con la sesión de recuperación                                           |
| `/api/contact`         | POST → email vía Resend                                                                  |

### Datos

- `lib/data.ts` — tipos (`Game`, `ScoreRow`, `User`), array `GAMES` (catálogo local / fallback), `CATS`, scores mock.
- `lib/skins.ts` + `components/SkinContext.tsx` — skin global (selector en `Nav`).
- `components/GamePad.tsx` — gamepad virtual táctil (móvil, bajo `lg`).
- `lib/supabase/client.ts` / `server.ts` — clientes `@supabase/ssr`.
- `lib/supabase/leaderboard.ts` — única capa de acceso: `fetchCatalog`, `fetchRealGames`, `fetchTopScores`, `insertScore`. Todas capturan errores y degradan (catálogo → `GAMES`, scores → `[]`); no lanzan.
- `components/UserContext.tsx` — Supabase Auth: `user` (`User` = `{ id, name, email, avatarUrl }`), `loading`, `signOut`; `toAppUser` mapea la sesión. `proxy.ts` + `lib/supabase/proxy.ts` refrescan la sesión por request.
- Guardar score exige sesión (RLS `authenticated insert own scores`: `auth.uid() = user_id`). Invitado juega pero el modal de game over solo muestra CTA a `/auth?next=…`. `scores.player_name` = texto escrito; `user_id` = identidad. Filas históricas con `user_id` NULL.

### Supabase

- Tablas: `games` (`slug` único, `name`, `active`, + campos de catálogo `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`) y `scores` (`game_slug` FK, `player_name`, `score`, `user_id`, `created_at`).
- RLS activo: lectura pública en ambas; insert en `scores` solo `authenticated` con `auth.uid() = user_id` (migración `20261116000000_auth_scores_rls.sql`).
- Migraciones en `supabase/migrations/`. MCP `supabase` configurado en `.mcp.json` (gitignored) — usar `mcp__supabase__*` para SQL/migraciones.
- Un juego es "real" si tiene fila `active` en `games`; el catálogo de Supabase manda sobre `lib/data.ts`, que solo rellena campos vacíos.

### Juegos canvas (`components/games/<slug>/`)

Patrón fijo; `asteroides` es la implementación canónica:

- `game.ts` — lógica vanilla sin React. Exporta `initGame(canvas, callbacks): GameController` con `{ pause, resume, destroy }`. Callbacks base `onScore` / `onGameOver`; opcionales según juego (`onLives`, `onLevel`, `onLines`).
- `skins.ts` — paletas/render por skin (`clasico`, `neon`, `retro`).
- `index.tsx` — componente cliente `({ gameId })`: refs de canvas y controller, HUD, modal de game over, `insertScore` + cache en `localStorage`.
- Se carga siempre con `dynamic(..., { ssr: false })` (usa `localStorage` en el estado inicial).
- Assets en `public/` (`public/games/arkanoid/`, `public/snake/`).

Claves `localStorage`: `av_skin` (skin global), `av_scores_<slug>` (solo con sesión; y `av_scores` del player mock).

Añadir un juego: `/add-game` → entrada en `GAMES`, `components/games/<slug>/`, ruta `jugar`, registro en `CANVAS_GAMES` (`app/juego/[id]/jugar/page.tsx`), fila en `games`. `/salon` y `/juego/[id]` no requieren cambios.

### Referencias (`references/`) — solo lectura

- `started-games/` — código fuente original (vanilla JS) de los juegos a portar.
- `source-assets/` — assets originales.
- `templates/` — maquetas JSX/HTML del diseño.
- `implemented-games.md` — tabla de juegos implementados (ID, título, categoría, color, descripción). Excepción al solo lectura: actualizarla al añadir un juego.
- `games-suggestions-todo.md` — TODO de juegos sugeridos. Excepción al solo lectura: lo mantiene el agente `game-planner`.
- `game-with-themes.md` — qué juegos tienen ya cada skin. Excepción al solo lectura: lo mantiene el agente `skin-designer`.

No importar desde `references/` ni modificar el resto.

## Environment

`.env.local` (plantilla en `.env.template`):

```
RESEND_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Screenshots (Playwright)

Always save screenshots to `.playwright-screenshots/` and reference them with `@.playwright-screenshots/`.

## Critical: This is NOT a standard Next.js version

Next.js 16 has breaking changes vs training data. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Ejemplos de la nueva API: `LayoutProps<"/">`, `PageProps<"/juego/[id]/jugar">`, `params` como `Promise` (se resuelve con `use()` dentro de `<Suspense>`).

Experimental flags active: `agentFeedback`, `cacheComponents`, `partialPrefetching`.

`AGENTS.md` lo regenera `next dev` — no editarlo.
