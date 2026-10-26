# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault — plataforma online para jugar y competir por puntos. Usa Spec Driven Design con los skills `/spec` y `/spec-impl` de `Klerith/fernando-skills`.

## Commands

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run lint     # ESLint
```

No test suite configured.

## Architecture

Next.js 16 App Router with React 19 and TypeScript strict mode.

- `app/` — App Router. Layout root in `app/layout.tsx`, entry page in `app/page.tsx`.
- `@/*` path alias maps to the repo root.
- Tailwind CSS v4 loaded via `@tailwindcss/turbopack` (not PostCSS — don't add a postcss config).
- Turbopack is the bundler; `next.config.ts` configures it directly.

## Critical: This is NOT a standard Next.js version

Next.js 16 has breaking changes vs training data. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. The `LayoutProps` generic type (`LayoutProps<"/">`) is one example of the new API shape.

Experimental flags active: `agentFeedback`, `cacheComponents`, `partialPrefetching`.
