# SPEC 16 — Actualizar Next.js 16.4.3 → 16.4.6

> **Status:** Implemented
> **Depends on:** SPEC 15
> **Date:** 2026-11-19
> **Objetivo:** Subir Next.js (y los paquetes que deben ir a la par) de 16.4.3 a 16.4.6 para recibir los fixes de seguridad de 16.4.5 sin cambios funcionales.

---

## Por qué existe este spec

Estado verificado el 2026-11-19 con `npm outdated`, `npm view` y docs de Context7 (`/vercel/next.js/v16.4.5`):

- `latest` de Next = 16.4.6. El proyecto está en 16.4.3 (pinned exacto).
- **16.4.5 es release de seguridad** (7 advisories _moderate_): fugas de caché en `'use cache'` (cross-tenant, root params, argumentos binarios, vía `unstable_cache`), cache poisoning de fallback shells en Cache Components, bypass de rechazo de SVG en optimización de imágenes, exposición de cookie HttpOnly en rutas Edge, y response injection en self-hosted.
- El proyecto tiene `cacheComponents: true` en `next.config.ts`, así que parte de la superficie aplica en teoría.
- Uso real hoy: ningún `'use cache'`, `unstable_cache` ni `next/image` en `app/`, `components/`, `lib/`. Riesgo práctico bajo, pero parchear es barato.
- 16.4.4 y 16.4.6 son backports de bugs (Turbopack, compresión de route handlers, `fast-jwt`, pin de Tailwind 4.3.3 en `create-next-app`).
- `next@16.4.6` requiere `react ^19` y `node >=20.9.0` (Node local: v25.2.0). `eslint-config-next@16.4.6` requiere `eslint >=9`.
- Docs oficiales: `npx @next/codemod@latest upgrade patch` (flags `--skip-react-upgrade`, `--skip-eslint-upgrade`).

---

## Scope

**In:**

- `next` 16.4.3 → 16.4.6 y `eslint-config-next` 16.4.3 → 16.4.6 (pinned exactos, siempre juntos).
- `react` y `react-dom` 19.3.0 → 19.3.1 (pinned exactos, siempre juntos).
- Patch/minor de dependencias sin riesgo funcional:
  - `@supabase/supabase-js` 2.119.0 → 2.119.2
  - `resend` 6.37.0 → 6.39.0
  - `prettier` 3.9.10 → 3.10.1
  - `@tailwindcss/turbopack` y `tailwindcss` 4.3.3 → 4.3.5 (ver Riesgos).
- Actualizar `package.json` y `package-lock.json`.
- Revisar `next.config.ts` y `proxy.ts` contra la salida del codemod; modificarlos solo si el build lo exige.
- Verificación: `npm run build`, `npm run lint`, prueba manual de rutas clave.

**Out of scope (para specs futuros):**

- Major bumps: `eslint` 9 → 10, `typescript` 5 → 7, `@types/node` 20 → 26.
- Subir `minor`/`major` de Next (16.5 canary / 17).
- Usar `'use cache'`, `next/image` u otras APIs de caché.
- Cambios en flags experimentales (`agentFeedback`, `partialPrefetching`).
- Actualizar `@supabase/ssr` u otras dependencias ya al día.
- Añadir tests automáticos o CI.

---

## Data model

Este spec no introduce datos ni estructuras nuevas. Solo cambian versiones en `package.json`:

```json
{
  "next": "16.4.6",
  "eslint-config-next": "16.4.6",
  "react": "19.3.1",
  "react-dom": "19.3.1",
  "@supabase/supabase-js": "^2.119.2",
  "resend": "^6.39.0",
  "prettier": "^3.10.1",
  "tailwindcss": "^4.3.5",
  "@tailwindcss/turbopack": "^4.3.5"
}
```

---

## Implementation plan

1. Rama `spec-16-actualizar-nextjs-16-4-6` (auto vía `/spec-impl`). Partir de árbol limpio: los cambios sin commit de `main` (`.claude/settings.json`, `app/contador/page.tsx`, `references/security/audit-log.md`) no se mezclan en este PR.
2. Línea base: `npm run build` y `npm run lint` en 16.4.3. Anotar warnings previos para distinguir los nuevos.
3. Ejecutar `npx @next/codemod@latest upgrade patch`. Revisar `git diff`: debe tocar solo `package.json` y `package-lock.json`. Si cambia código o `next.config.ts`, justificarlo en el PR.
4. Confirmar que `package.json` quedó con `next`, `eslint-config-next` en 16.4.6 y `react`/`react-dom` en 19.3.1. Si el codemod no los tocó: `npm install next@16.4.6 eslint-config-next@16.4.6 react@19.3.1 react-dom@19.3.1 --save-exact`.
5. Subir las dependencias opcionales: `npm install @supabase/supabase-js@^2.119.2 resend@^6.39.0 && npm install -D prettier@^3.10.1`.
6. Subir Tailwind: `npm install -D tailwindcss@^4.3.5 @tailwindcss/turbopack@^4.3.5`. Si el build o el CSS fallan, revertir solo este paso (ver Riesgos) y dejar ambos en 4.3.3.
7. `npm run build` y `npm run lint` sin errores ni warnings nuevos.
8. Prueba manual con `npm run dev`: `/`, `/biblioteca`, `/juego/asteroides/jugar`, `/salon`, `/auth` (login y redirect), `/acerca` (formulario de contacto). Revisar consola del navegador y terminal.
9. Verificar headers de seguridad (SPEC 15) en una respuesta: `curl -sI localhost:3000/` muestra `x-content-type-options`, `x-frame-options`, `referrer-policy`.
10. Actualizar `CLAUDE.md` si menciona versiones de Next (la sección Architecture dice "Next.js 16" genérico: probablemente sin cambios). Marcar `Status: Implemented`.

---

## Acceptance criteria

- [X]`npm ls next eslint-config-next react react-dom` muestra 16.4.6, 16.4.6, 19.3.1, 19.3.1.
- [X]`package.json` mantiene `next` y `eslint-config-next` con la misma versión exacta.
- [X]`npm run build` termina con exit code 0.
- [X]`npm run lint` termina con exit code 0 y sin warnings nuevos respecto a la línea base.
- [X]`npm outdated` ya no lista `next`, `eslint-config-next`, `react`, `react-dom`, `@supabase/supabase-js`, `resend`, `prettier`.
- [X]`eslint`, `typescript` y `@types/node` siguen en sus majors actuales (9, 5, 20).
- [X]Un juego canvas carga y guarda un score con sesión iniciada sin errores en consola.
- [X]Login/logout en `/auth` funcionan y el redirect de `/auth` con sesión sigue activo.
- [X]Las respuestas de `/` incluyen los 3 headers de SPEC 15.
- [X]El estilo (clases `btn`, `crt`, `cover-*`) se renderiza igual que antes de la actualización.
- [X]El diff del PR toca solo `package.json`, `package-lock.json` y, si fue necesario, `next.config.ts`/`proxy.ts`.

---

## Decisiones tomadas y descartadas

- **Sí:** `patch` (16.4.3 → 16.4.6). Mismo minor, sin breaking changes; el codemod `upgrade patch` es la vía documentada.
- **Sí:** subir `react`/`react-dom` junto con Next. El codemod ya los gestiona y mantiene el par sincronizado.
- **Sí:** mantener pinned exactos en `next`, `eslint-config-next`, `react`, `react-dom` (convención actual del repo).
- **Sí:** incluir patch/minor menores en el mismo spec. Riesgo bajo y evita PRs de una línea.
- **No:** `eslint` 10, `typescript` 7, `@types/node` 26. Son majors con riesgo propio; cada uno merece su spec.
- **No:** `next@canary` / 16.5. Inestable, sin necesidad.
- **No:** esperar a que `'use cache'` se use para parchear. Los advisories se corrigen igual y el flag `cacheComponents` ya está activo.
- **No:** `--skip-eslint-upgrade`. El codemod solo toca `eslint-config-next` dentro del mismo minor; no sube ESLint a 10 en patch.

---

## Riesgos identificados

| Riesgo                                                                                                              | Mitigación                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Next 16.4.6 fijó Tailwind en 4.3.3 en sus templates y tests; 4.3.5 podría romper `@tailwindcss/turbopack` o el CSS. | Paso 6 aislado. Si falla, revertir a 4.3.3 y anotarlo en Decisiones.                            |
| El codemod modifica archivos no previstos (p. ej. `next.config.ts`).                                                | Revisar `git diff` en el paso 3; revertir cambios no justificados.                              |
| Cambios sin commit en `main` se mezclan en el PR.                                                                   | Paso 1: commitear o stashear antes de crear la rama.                                            |
| Regresión de Turbopack en dev (16.4.6 trae fixes de GC).                                                            | Prueba manual del paso 8; si falla, bajar a 16.4.5 (contiene los fixes de seguridad).           |
| `npm outdated` / advisories cambian entre la redacción y la implementación (hoy 2026-11-19).                        | Re-ejecutar `npm view next dist-tags` al implementar y usar el `latest` vigente del minor 16.4. |

---

## What is **not** in this spec

- Major bumps de ESLint, TypeScript o `@types/node`.
- Migrar a Next 16.5 / 17.
- Adoptar `'use cache'`, `next/image` o cambios de caché.
- Tests automáticos o CI.
- Cambios funcionales o visuales en la app.

Cada uno, si se hace, va en su propio spec.
