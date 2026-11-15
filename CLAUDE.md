# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault — plataforma online para jugar y competir por puntos. Juegos canvas reales (Asteroides, Tetris, Arkanoid, Snake) con leaderboard en Supabase; el resto del catálogo son entradas mock.

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

| Skill        | Uso                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `/spec`      | Diseña un spec nuevo. No escribe código.                                                         |
| `/spec-impl` | Implementa un spec aprobado. Crea la rama `spec-NN-slug` (auto, ver `specs/.spec-config.yml`).   |
| `/add-game`  | Genera el spec combinado juego + leaderboard para un juego nuevo. Solo spec; luego `/spec-impl`. |

- `/spec` y `/spec-impl` vienen de `Klerith/fernando-skills` (fuente en `.agents/skills/`, symlinks en `.claude/skills/`, versiones en `skills-lock.json`). No editarlos a mano.
- `/add-game` es local del proyecto (`.claude/skills/add-game/SKILL.md`).
- Agente `game-planner` (`.claude/agents/game-planner.md`, memoria en `.claude/agent-memory/game-planner/`): sugiere el próximo juego y lo anota en `references/games-suggestions-todo.md`. Flujo: `game-planner` → `/add-game` → `/spec-impl`.
- Agente `game-jam` (`.claude/agents/game-jam.md`): recibe un tema, inventa un juego original y escribe 2–3 specs en `specs/game-jam/<game-id>/` (`01-…-juego`, `02-…-integracion`, `03-…-pulido` o `03-…-<feature>`). Corre con `model: sonnet`. Autónomo, sin preguntas, solo specs en `Borrador`. Para implementar: promover a `specs/NN-slug.md` y `/spec-impl`.
- Un spec = una rama `spec-NN-slug` = un PR a `main`. Al terminar, `Status: Implemented` en el spec.

## Architecture

Next.js 16 App Router con React 19 y TypeScript strict.

- `@/*` path alias → raíz del repo.
- Tailwind CSS v4 vía `@tailwindcss/turbopack` (no PostCSS — no añadir postcss config). Estilos globales y clases del tema arcade (`btn`, `crt`, `av-player`, `cover-*`…) en `app/globals.css`.
- Turbopack es el bundler; `next.config.ts` lo configura directamente.

### Rutas (`app/`)

| Ruta                  | Contenido                                                              |
| --------------------- | ---------------------------------------------------------------------- |
| `/`                   | Home                                                                   |
| `/biblioteca`         | Catálogo de juegos                                                     |
| `/juego/[id]`         | Ficha del juego + leaderboard lateral                                  |
| `/juego/[id]/jugar`   | Reproductor: juego canvas si está en `CANVAS_GAMES`, si no player mock |
| `/juego/<slug>/jugar` | Rutas estáticas por juego (arkanoid, snake, tetris)                    |
| `/salon`              | Salón de la fama (leaderboard global + tab por juego)                  |
| `/acerca`             | About + formulario de contacto                                         |
| `/auth`               | Login mock                                                             |
| `/api/contact`        | POST → email vía Resend                                                |

### Datos

- `lib/data.ts` — tipos (`Game`, `ScoreRow`, `User`), array `GAMES` (catálogo local / fallback), `CATS`, scores mock.
- `lib/supabase/client.ts` / `server.ts` — clientes `@supabase/ssr`.
- `lib/supabase/leaderboard.ts` — única capa de acceso: `fetchCatalog`, `fetchRealGames`, `fetchTopScores`, `insertScore`. Todas capturan errores y degradan (catálogo → `GAMES`, scores → `[]`); no lanzan.
- `components/UserContext.tsx` — auth mock en `localStorage` (`av_user`). No hay Supabase Auth; `scores.user_id` siempre `null`.

### Supabase

- Tablas: `games` (`slug` único, `name`, `active`, + campos de catálogo `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`) y `scores` (`game_slug` FK, `player_name`, `score`, `user_id`, `created_at`).
- RLS activo: lectura pública en ambas, insert público en `scores`.
- Migraciones en `supabase/migrations/`. MCP `supabase` configurado en `.mcp.json` (gitignored) — usar `mcp__supabase__*` para SQL/migraciones.
- Un juego es "real" si tiene fila `active` en `games`; el catálogo de Supabase manda sobre `lib/data.ts`, que solo rellena campos vacíos.

### Juegos canvas (`components/games/<slug>/`)

Patrón fijo; `asteroides` es la implementación canónica:

- `game.ts` — lógica vanilla sin React. Exporta `initGame(canvas, callbacks): GameController` con `{ pause, resume, destroy }`. Callbacks base `onScore` / `onGameOver`; opcionales según juego (`onLives`, `onLevel`, `onLines`).
- `index.tsx` — componente cliente `({ gameId })`: refs de canvas y controller, HUD, modal de game over, `insertScore` + cache en `localStorage`.
- Se carga siempre con `dynamic(..., { ssr: false })` (usa `localStorage` en el estado inicial).
- Assets en `public/` (`public/games/arkanoid/`, `public/snake/`).

Claves `localStorage`: `av_user`, `av_player_name`, `av_scores_<slug>` (y `av_scores` del player mock).

Añadir un juego: `/add-game` → entrada en `GAMES`, `components/games/<slug>/`, ruta `jugar`, registro en `CANVAS_GAMES` (`app/juego/[id]/jugar/page.tsx`), fila en `games`. `/salon` y `/juego/[id]` no requieren cambios.

### Referencias (`references/`) — solo lectura

- `started-games/` — código fuente original (vanilla JS) de los juegos a portar.
- `source-assets/` — assets originales.
- `templates/` — maquetas JSX/HTML del diseño.
- `implemented-games.md` — tabla de juegos implementados (ID, título, categoría, color, descripción). Excepción al solo lectura: actualizarla al añadir un juego.
- `games-suggestions-todo.md` — TODO de juegos sugeridos. Excepción al solo lectura: lo mantiene el agente `game-planner`.

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
