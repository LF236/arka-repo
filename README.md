## Arcade Vault

Plataforma para jugar online y competir por la mayor cantidad de puntos. Juegos canvas reales (Asteroides, Tetris, Arkanoid, Snake, Frogger) con leaderboard en Supabase; el resto del catálogo son entradas mock.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS v4 · Supabase · Resend.

## Desarrollo

```bash
npm install
cp .env.template .env.local   # RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev      # dev server
npm run build    # build de producción
npm run lint     # ESLint
```

No hay suite de tests: verificación = `npm run build` + `npm run lint` + prueba manual en navegador.

## Spec Driven Design

Todo cambio funcional pasa por un spec en `specs/NN-slug.md`. Un spec = una rama `spec-NN-slug` = un PR a `main`.

Basado en `/spec` y `/spec-impl`, siguiendo las buenas prácticas de https://github.com/Klerith/fernando-skills

```bash
npx skills@latest add Klerith/fernando-skills
```

Skills locales: `/add-game`, `/spec-impl-game`.

Agentes (`.claude/agents/`): `game-planner`, `game-jam`, `skin-designer`, `mobile-porter`, `game-performance-booster`. Detalle en `CLAUDE.md`.
