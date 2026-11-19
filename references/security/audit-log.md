# Bitácora de seguridad — Arcade Vault

## Hallazgos abiertos

| ID      | Sev   | Área | Título                                                                                   | Desde      |
| ------- | ----- | ---- | ---------------------------------------------------------------------------------------- | ---------- |
| SEC-001 | Medio | App  | `next` 16.2.0–16.4.4 con advisories (fuga de cache `use cache`)                          | 2026-11-18 |
| SEC-002 | Bajo  | DB   | `anon`/`authenticated` con TRUNCATE, REFERENCES, TRIGGER en games/scores                 | 2026-11-18 |
| SEC-003 | Bajo  | App  | `/api/contact`: sin límite de tamaño ni validación de email/JSON; filtra `error.message` | 2026-11-18 |

## Excepciones y riesgos aceptados

- Aceptado: `auth_leaked_password_protection` (plan Free). Revisar al subir a Pro.
- Pendiente/Aceptado (fuera de scope SPEC 15): CSP, HSTS, Permissions-Policy, rate limit de scores y de `/api/contact`, anti-cheat, headers en assets excluidos por el matcher.
- No verificable por MCP — confirmar manualmente en dashboard: min password 8, rate limit signup 15/h/IP, Redirect URLs.

## Auditorías

### 2026-11-18 — DB+App — spec-15-seguridad-basica @ 868da32

- Revisado: RLS (games, scores = true); policies (solo las 3 esperadas); grants; funciones/vistas en public (ninguna); advisors (solo leaked protection); migraciones (4 locales = 4 remotas; el timestamp remoto de `security_hardening` es 20261119012533 vs 20261118000000 local, mismo nombre, sin drift de contenido; el archivo solo contiene REVOKE); pruebas por rol con ROLLBACK (anon ins/upd/del/games upd = deny; authenticated user_id ajeno, upd, del, insert en games = deny; scores sigue en 22 filas); logs auth/postgres 24h (sin errores); headers en runtime con dev server (`/`, `/salon`, `/auth`, `/juego/asteroides/jugar`: 3 headers OK); `safeNext` y sus 3 usos (auth/page.tsx:44, callback/route.ts:8, lib/supabase/proxy.ts:40) correctos; proxy usa `getUser()`, sin `getSession()`; secretos: solo `process.env.RESEND_API_KEY` en `app/api/contact/route.ts:5,21`, sin JWT/service_role en código, `.env*` y `.mcp.json` en `.gitignore`, sin historial de `.env.local`/`.mcp.json`; sin `dangerouslySetInnerHTML`/`eval`/`innerHTML`; localStorage solo `av_*`.
- Nuevos: SEC-001, SEC-002, SEC-003
- Resueltos desde la anterior: n/a (primera auditoría)

#### SEC-001 — Medio — App — `next` vulnerable

- Evidencia: `npm audit --omit=dev` → next 16.2.0–16.4.4, moderate (GHSA-mfr8-8qww-v76h, GHSA-vc7v-qv4w-wrv8); fix en 16.4.6.
- Impacto: fuga entre valores de root params con `use cache`/`unstable_cache`. El proyecto usa `cacheComponents`; explotabilidad real sin confirmar (no se usan root params conocidos).
- Remediación: actualizar a next >= 16.4.6 y revalidar build/navegación. Estado: Abierto.

#### SEC-002 — Bajo — DB — privilegios sobrantes

- Evidencia: `information_schema.role_table_grants`: anon y authenticated tienen TRUNCATE, REFERENCES, TRIGGER en `games` y `scores`.
- Impacto: TRUNCATE ignora RLS. PostgREST no lo expone, así que no es explotable por la API; solo defensa en profundidad (SPEC 15 pide "nadie con escritura").
- Remediación: migración `REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.games, public.scores FROM anon, authenticated;`. Estado: Abierto.

#### SEC-003 — Bajo — App — `/api/contact`

- Evidencia: `app/api/contact/route.ts:11` `await req.json()` sin try/catch (JSON inválido → 500); sin máximo de longitud en name/email/msg; email sin formato validado (se usa en `replyTo`); `:34` devuelve `error.message` de Resend al cliente. Email en `text` (sin HTML), así que no hay inyección HTML. Destinatario hardcodeado en `:25`.
- Impacto: abuso/spam de cuota Resend (rate limit ya aceptado como pendiente), payloads enormes, fuga menor de detalles del proveedor.
- Remediación: try/catch en json, límites de longitud, regex de email, mensaje de error genérico, destinatario por env. Estado: Abierto.
