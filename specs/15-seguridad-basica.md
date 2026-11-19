# SPEC 15 — Seguridad básica

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 06, SPEC 14
> **Date:** 2026-11-18
> **Objetivo:** Cerrar el checklist de seguridad básico: endurecer grants/RLS de `games` y `scores`, añadir headers de seguridad vía `proxy.ts` y configurar las protecciones de Supabase Auth (longitud mínima, leaked password, rate limit de signup).

---

## Por qué existe este spec

`references/security/security-checklist.md` lista medidas pendientes. Estado verificado el 2026-11-18:

- RLS ya activo en `games` y `scores`. Policies: `public read games` y `public read scores` (SELECT), `authenticated insert own scores` (`auth.uid() = user_id`). Sin policy de UPDATE/DELETE → RLS lo deniega.
- `proxy.ts` + `lib/supabase/proxy.ts` ya existen (SPEC 14, `updateSession`).
- `get_advisors(security)`: único warning = `auth_leaked_password_protection`.
- `next.config.ts` no define `headers()`.
- La validación de contraseña vive solo en cliente (`lib/password.ts`, `app/auth/page.tsx`).

---

## Scope

**In:**

- Migración `supabase/migrations/20261118000000_security_hardening.sql` (defensa en profundidad sobre RLS):
  - `REVOKE INSERT, UPDATE, DELETE ON games FROM anon, authenticated`.
  - `REVOKE UPDATE, DELETE ON scores FROM anon, authenticated`.
  - `REVOKE INSERT ON scores FROM anon`.
  - Se conservan: SELECT público y INSERT de `authenticated` en `scores` (policy `authenticated insert own scores`).
  - Ningún usuario modifica juegos (no hay rol admin); el catálogo se cambia por migración/MCP.
- Headers de seguridad en `proxy.ts` vía `lib/supabase/proxy.ts`, en la respuesta normal **y** en el redirect de `/auth` con sesión:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - Helper `applySecurityHeaders(response)` en `lib/security-headers.ts`.
- Configuración manual en el dashboard de Supabase (Authentication):
  - Minimum password length = 8 (coincide con `lib/password.ts`).
  - Leaked password protection activada (solo plan Pro; en Free queda como excepción aceptada y documentada).
  - Rate limit de signups por IP (valor elegido anotado al implementar).
- Verificar que el mínimo de 8 del cliente coincide con el del servidor.
- Actualizar `CLAUDE.md` (Supabase/RLS y proxy) y marcar los ítems en `references/security/security-checklist.md`.

**Out of scope (para specs futuros):**

- Content-Security-Policy (riesgo de romper OAuth Google/GitHub, Supabase, Resend, canvas/audio).
- HSTS, Permissions-Policy.
- Rol admin / gestión de juegos desde la app.
- Rate limiting de scores, anti-cheat, rate limit de `/api/contact`.
- MFA, CAPTCHA.
- Headers en assets excluidos por el matcher del proxy.

---

## Data model

Sin tablas ni columnas nuevas. Solo cambian grants; las policies RLS no cambian.

```sql
-- 20261118000000_security_hardening.sql
REVOKE INSERT, UPDATE, DELETE ON public.games FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.scores FROM anon, authenticated;
REVOKE INSERT ON public.scores FROM anon;
```

```ts
// lib/security-headers.ts
export function applySecurityHeaders<T extends Response>(response: T): T;
```

---

## Implementation plan

1. **Dashboard Supabase (manual).** Authentication: min password length 8, leaked password protection (si el plan lo permite), rate limit de signups. Verificación: `get_advisors(security)` sin `auth_leaked_password_protection` (o excepción documentada).
2. **Migración REVOKE** vía `mcp__supabase__apply_migration`. Verificación: `has_table_privilege` por rol y `pg_policies` sin cambios.
3. **Pruebas SQL por rol** con `mcp__supabase__execute_sql` (`SET LOCAL ROLE anon|authenticated` + `request.jwt.claims`): anon no inserta/actualiza/borra; authenticated inserta propio; con `user_id` ajeno falla; UPDATE/DELETE en `scores` y cualquier escritura en `games` fallan; SELECT público OK.
4. **Headers en el proxy** (`lib/security-headers.ts` + `lib/supabase/proxy.ts`, ambos `return`). Leer antes `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Verificación: `curl -I` a `/`, `/salon`, `/auth`.
5. **Docs y cierre.** `CLAUDE.md`, checklist de seguridad, `Status: Implemented`. Verificación: `npm run build` y `npm run lint`.

---

## Acceptance criteria

- [X] `relrowsecurity = true` en `games` y `scores`.
- [X] Anon no puede INSERT/UPDATE/DELETE en `scores` ni en `games`.
- [X] Authenticated: INSERT con `user_id = auth.uid()` pasa; INSERT con `user_id` ajeno, UPDATE y DELETE en `scores` fallan; cualquier escritura en `games` falla.
- [X] SELECT público funciona en ambas tablas; `/salon` y `/juego/[id]` muestran scores sin sesión.
- [X] Las respuestas de `/`, `/salon` y `/juego/asteroides/jugar` incluyen los 3 headers.
- [X] El redirect de `/auth` con sesión incluye los 3 headers y conserva las cookies.
- [X] Un registro con contraseña < 8 caracteres es rechazado por el servidor (no solo por el cliente).
- [X] `get_advisors(security)` no reporta `auth_leaked_password_protection`, o la excepción por plan Free está documentada en este spec.
- [X] Rate limit de signups configurado y su valor anotado en este spec.
- [X] OAuth, recarga con sesión y guardado de score al terminar partida siguen funcionando.
- [X] `npm run build` y `npm run lint` pasan sin errores nuevos.

---

## Configuración aplicada en Supabase Auth (2026-11-18)

- Minimum password length = 8.
- Rate limit de signups: 15 por hora por IP.
- Leaked password protection: **no activada — excepción aceptada (plan Free)**. El advisor `auth_leaked_password_protection` seguirá apareciendo. Revisar al subir a Pro.

---

## Decisiones tomadas y descartadas

- **Sí: headers en `proxy.ts`.** Decisión del usuario; reutiliza el proxy de SPEC 14. Descartado: `next.config.ts` `headers()`.
- **No: CSP en este spec.** Alto riesgo de regresión (OAuth, Supabase, canvas); va en spec propio, idealmente primero Report-Only.
- **Sí: REVOKE explícito además de RLS.** Segunda barrera si alguien crea una policy permisiva por error.
- **Sí: policies existentes sin cambios.** SELECT público, INSERT `auth.uid() = user_id`; ya cumplen lo pedido.
- **Sí: juegos inmutables desde cliente.** Sin rol admin; cambios por migración/MCP (`service_role` no se ve afectado por los REVOKE).
- **Sí: leaked protection condicionada al plan.** Disponible solo en Pro; en Free queda como excepción aceptada.

---

## Riesgos identificados

| Riesgo                                                        | Mitigación                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `X-Frame-Options: DENY` rompe iframes/embeds                  | No hay embeds en el proyecto; probar OAuth y navegación tras el paso 4.     |
| Redirect de `/auth` sin headers o sin cookies                 | Aplicar `applySecurityHeaders` también al redirect; criterio de aceptación. |
| Rate limit de signup demasiado bajo bloquea usuarios tras NAT | Valor moderado; documentarlo y ajustar si hay quejas.                       |
| Leaked protection no disponible en plan Free                  | Excepción documentada; revisar al subir de plan.                            |
| Assets excluidos por el matcher no reciben headers            | Aceptado; no son documentos HTML.                                           |
| `proxy.ts` + `cacheComponents`/`partialPrefetching`           | Leer `proxy.md` antes; probar navegación con sesión tras el paso 4.         |

---

## What is **not** in this spec

- Content-Security-Policy, HSTS, Permissions-Policy.
- Rol admin y gestión de juegos desde la app.
- Rate limiting de scores, anti-cheat, rate limit de `/api/contact`.
- MFA, CAPTCHA.

Cada uno, si llega, va en su propio spec.
