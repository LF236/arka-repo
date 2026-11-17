# SPEC 14 — Autenticación con Supabase Auth

> **Status:** Approved
> **Depends on:** SPEC 04, SPEC 06
> **Date:** 2026-11-16
> **Objetivo:** Reemplazar el login mock por Supabase Auth (email+contraseña, Google y GitHub, verificación por correo y recuperación de contraseña) y exigir sesión para guardar puntuaciones, registrando `user_id` y el nombre escrito en cada score.

---

## Por qué existe este spec

Hoy `/auth` es un mock: `UserContext` guarda `{ name }` en `localStorage` (`av_user`) y `scores.user_id` es siempre `null` (SPEC 06). Con auth real el leaderboard puede atribuir scores a una cuenta estable. El nombre mostrado en el leaderboard (`player_name`) se guarda tal cual lo escribe el jugador, porque puede cambiar de nombre después; `user_id` es la identidad real.

---

## Scope

**In:**

- Pantalla `/auth` (`app/auth/page.tsx`) conectada a Supabase:
  - Tab "Iniciar sesión": email + contraseña, botones Google y GitHub, enlace "¿Olvidaste tu contraseña?".
  - Tab "Crear cuenta": usuario, email, contraseña. `username` se guarda en `user_metadata.username`.
  - Tras registro exitoso con email: se permanece en `/auth` con mensaje "Revisa tu correo para verificar tu cuenta". Sin sesión hasta verificar.
  - Errores mapeados a mensajes en español (credenciales inválidas, email no verificado, email ya registrado, contraseña débil).
  - "Jugar como invitado" se mantiene (navega a `/`).
- `app/auth/callback/route.ts` — route handler GET: lee `code`, llama `exchangeCodeForSession`, redirige a `next` (por defecto `/`). Sirve para OAuth, verificación de email y recuperación.
- Recuperación de contraseña:
  - Enlace en `/auth` → vista "Recuperar contraseña" (solo email) → `resetPasswordForEmail` con `redirectTo` = `/auth/callback?next=/auth/reset-password`.
  - `app/auth/reset-password/page.tsx` — con la sesión de recuperación ya establecida por el callback, formulario de nueva contraseña (+ confirmación) → `updateUser({ password })` → redirige a `/`. Sin sesión de recuperación válida muestra "Enlace inválido o expirado" con enlace a `/auth`.
- `components/UserContext.tsx` migrado a Supabase: `user`, `loading`, `signOut`; se hidrata con `getUser()` y escucha `onAuthStateChange`. Elimina `av_user` de localStorage (y limpia la clave residual).
- `proxy.ts` (raíz) + `lib/supabase/proxy.ts` — refresco de sesión por request con `@supabase/ssr` (Next 16 usa `proxy`, no `middleware`; leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` antes). Matcher excluye `_next/static`, `_next/image`, favicon y assets.
- `components/Nav.tsx`: estado de sesión = avatar + nombre + "Cerrar sesión". Avatar: `user_metadata.avatar_url` (Google/GitHub) o inicial del nombre en círculo. Sin sesión: botón "Iniciar Sesión".
- Guardado de puntuaciones (5 juegos: asteroides, tetris, arkanoid, snake, frogger, en `components/games/<slug>/index.tsx`):
  - Invitado: el modal de game over muestra puntuación final + CTA "Inicia sesión para guardar tu puntuación" → `/auth?next=/juego/<slug>/jugar`. No se escribe en Supabase ni en `av_scores_<slug>`.
  - Con sesión: input de nombre pre-rellenado con el nombre del usuario (editable); al guardar se inserta `player_name` (lo escrito) + `user_id` (`auth.uid()`), más cache `av_scores_<slug>`.
- `lib/supabase/leaderboard.ts`: `insertScore` recibe `userId`.
- Migración SQL `supabase/migrations/20261116000000_auth_scores_rls.sql`: endurece RLS de insert en `scores`.
- Configuración manual en el dashboard de Supabase (documentada en el spec, no automatizable por código): ver Plan paso 1.

**Out of scope (para specs futuros):**

- Edición de perfil / cambio de nombre de usuario (pantalla `/perfil`).
- Unicidad de `username` (es solo etiqueta; la identidad es `user_id`).
- Vincular varias identidades (email + Google + GitHub) a la misma cuenta manualmente.
- Roles, moderación, borrar cuenta, MFA, magic link / OTP.
- Migrar o reasignar scores históricos con `user_id NULL` (se conservan tal cual).
- Cache local de scores para invitados.
- Rate limiting / anti-cheat de scores.
- Páginas protegidas por sesión (todo el sitio sigue siendo público; solo guardar score requiere login).
- Cambios en `/salon` y `/juego/[id]` (la lectura sigue pública).

---

## Data model

### `scores` (cambios sobre SPEC 06)

Columnas existentes, sin cambios de esquema: `player_name text NOT NULL` (nombre tal como lo escribió el jugador) y `user_id uuid REFERENCES auth.users(id)` (nullable: filas históricas).

```sql
-- 20261116000000_auth_scores_rls.sql
DROP POLICY "public insert scores" ON scores;

CREATE POLICY "authenticated insert own scores" ON scores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX scores_user_id_idx ON scores (user_id);
```

`SELECT` público se mantiene.

### `user_metadata` (Supabase Auth)

```ts
// Registro email+password: options.data
{ username: string }            // lo escrito en el formulario
// OAuth (Google/GitHub), lo pone el provider:
{ full_name?, name?, user_name?, avatar_url?, picture? }
```

### `lib/data.ts`

```ts
export interface User {
  id: string; // auth.users.id
  name: string; // resuelto: username ?? full_name ?? name ?? user_name ?? parte local del email
  email: string | null;
  avatarUrl: string | null; // avatar_url ?? picture ?? null
}
```

### `components/UserContext.tsx`

```ts
interface UserContextValue {
  user: User | null;
  loading: boolean; // true hasta resolver la sesión inicial
  signOut: () => Promise<void>;
}
```

Se elimina `login`. El mapeo `Session.user → User` vive en una función pura exportada (`toAppUser`) en el mismo archivo.

### `lib/supabase/leaderboard.ts`

```ts
export async function insertScore(
  gameSlug: string,
  playerName: string,
  score: number,
  userId: string,
): Promise<void>; // mantiene captura de errores sin lanzar
```

### Rutas nuevas

| Ruta                   | Tipo          | Función                                            |
| ---------------------- | ------------- | -------------------------------------------------- |
| `/auth/callback`       | route handler | `exchangeCodeForSession(code)` → redirect a `next` |
| `/auth/reset-password` | página        | nueva contraseña con la sesión de recuperación     |

`next` solo se acepta si empieza por `/` y no por `//` (anti open-redirect); si no, `/`.

### localStorage

- Se elimina `av_user`.
- `av_player_name` deja de escribirse (el nombre viene de la cuenta).
- `av_scores_<slug>` se mantiene, solo se escribe con sesión.

---

## Implementation plan

1. **Configuración en Supabase (manual, dashboard).** Authentication → URL Configuration: Site URL y Redirect URLs (`http://localhost:3000/**` y la URL de producción). Providers: habilitar Email (con "Confirm email" activo), Google y GitHub (client id/secret de cada consola OAuth; callback de Supabase `https://<ref>.supabase.co/auth/v1/callback`). Opcional: traducir plantillas de correo. Verificación: el provider aparece habilitado en el dashboard.
2. **`UserContext` con Supabase** (`components/UserContext.tsx`, `lib/data.ts`). Nuevo tipo `User`, `toAppUser`, `getUser()` + `onAuthStateChange`, `signOut` con `supabase.auth.signOut()`. Limpiar `av_user`. Verificación: build compila; sin sesión `user === null`.
3. **Callback** (`app/auth/callback/route.ts`). `exchangeCodeForSession` con `lib/supabase/server.ts`; validar `next`; en error redirigir a `/auth?error=callback`. Verificación: visitar `/auth/callback` sin `code` redirige a `/auth?error=callback`.
4. **`proxy.ts` + `lib/supabase/proxy.ts`.** Refresco de cookies de sesión por request. Verificación: tras login, recargar mantiene la sesión; sin errores de cookies en consola.
5. **`/auth` — registro y login con email** (`app/auth/page.tsx`). `signUp` con `options.data.username` y `emailRedirectTo = /auth/callback`; `signInWithPassword`; estados de carga/error/"revisa tu correo". Verificación: registro muestra mensaje y no crea sesión; tras verificar, login lleva a `/`.
6. **`/auth` — OAuth.** `signInWithOAuth({ provider, options: { redirectTo: /auth/callback?next=… } })` en botones Google/GitHub. Verificación: login con cada provider vuelve a `/` con sesión.
7. **Recuperación de contraseña** (vista en `/auth` + `app/auth/reset-password/page.tsx`). Verificación: correo llega, enlace abre `/auth/reset-password` con sesión, cambiar contraseña y volver a entrar funciona.
8. **Nav** (`components/Nav.tsx`). Avatar + nombre + "Cerrar sesión"; estado `loading` sin parpadeo del botón "Iniciar Sesión". Verificación manual con y sin sesión, desktop y móvil.
9. **Migración RLS** (`supabase/migrations/20261116000000_auth_scores_rls.sql`) aplicada vía `mcp__supabase__apply_migration`. Verificación con `mcp__supabase__execute_sql`: insert anónimo falla, insert autenticado con `user_id = auth.uid()` pasa.
10. **`insertScore` + modales de game over** (`lib/supabase/leaderboard.ts` y los cinco `components/games/<slug>/index.tsx`). `userId` obligatorio; invitado ve CTA a `/auth?next=…`; con sesión, input pre-rellenado con `user.name`. Verificación: score guardado con `user_id` y `player_name` correctos en cada juego.
11. **Limpieza.** Quitar usos de `av_player_name` y de `login` en el resto del código (incluido `app/juego/[id]/jugar/page.tsx` si aplica). Actualizar `CLAUDE.md` (sección `UserContext`, `localStorage`, rutas, `scores.user_id`) y `.env.template` si hiciera falta. Verificación: `grep` sin referencias residuales; `npm run build` y `npm run lint`.

---

## Acceptance criteria

- [ ] Registro con email+contraseña+usuario deja `user_metadata.username` guardado y envía el correo de verificación.
- [ ] Tras registrarse, la app permanece en `/auth` con el mensaje de revisar el correo y sin sesión activa.
- [ ] Iniciar sesión con email no verificado muestra un error en español y no crea sesión.
- [ ] Tras verificar el correo, el enlace pasa por `/auth/callback` y deja al usuario con sesión en `/`.
- [ ] Login con Google y con GitHub crea sesión y redirige a `/`.
- [ ] `/auth/callback` con `next=//evil.com` o `next=https://evil.com` redirige a `/`.
- [ ] "¿Olvidaste tu contraseña?" envía correo; su enlace abre `/auth/reset-password` y permite fijar nueva contraseña; la contraseña anterior deja de funcionar.
- [ ] `/auth/reset-password` sin sesión de recuperación muestra "Enlace inválido o expirado".
- [ ] Recargar la página mantiene la sesión (cookies refrescadas por `proxy.ts`).
- [ ] Nav con sesión muestra avatar (imagen OAuth o inicial), nombre y "Cerrar sesión"; cerrar sesión vuelve a mostrar "Iniciar Sesión".
- [ ] Un invitado puede jugar los 5 juegos canvas completos sin sesión.
- [ ] Al terminar partida, un invitado ve el CTA de login y no se crea fila en `scores` ni clave `av_scores_<slug>`.
- [ ] Tras login desde ese CTA, el usuario vuelve a `/juego/<slug>/jugar`.
- [ ] Con sesión, el input de nombre viene con el nombre del usuario y es editable.
- [ ] Al guardar, la fila en `scores` tiene `player_name` = texto escrito y `user_id` = id del usuario (verificado con `mcp__supabase__execute_sql`).
- [ ] Un `INSERT` anónimo en `scores` (cliente sin sesión) es rechazado por RLS.
- [ ] Un `INSERT` con `user_id` distinto de `auth.uid()` es rechazado por RLS.
- [ ] `SELECT` público sigue funcionando: `/salon` y `/juego/[id]` muestran scores sin sesión; filas antiguas con `user_id NULL` siguen visibles.
- [ ] No quedan referencias a `av_user`, `login()` del contexto mock ni `av_player_name` en `app/`, `components/` y `lib/`.
- [ ] `npm run build` y `npm run lint` pasan sin errores nuevos.

---

## Decisiones tomadas y descartadas

- **Sí: Supabase Auth con email+password, Google y GitHub.** Decisión cerrada por el usuario.
- **Sí: verificación de correo obligatoria.** Sin sesión hasta verificar; el usuario se queda en `/auth` con aviso.
- **Sí: `username` en `user_metadata`.** No hay tabla `profiles`: menos piezas; suficiente para mostrar nombre. Una tabla de perfiles queda para el spec de edición de perfil.
- **Sí: guardar `player_name` (texto escrito) + `user_id`.** El nombre puede cambiar con el tiempo; `user_id` identifica al jugador de forma estable. El input se pre-rellena con el nombre de la cuenta.
- **Sí: invitado juega pero no guarda.** El modal ofrece login con retorno vía `next`. Descartado: guardar solo en localStorage (datos que nunca llegan al ranking) y guardar score pendiente tras login (complejidad de estado entre redirecciones).
- **Sí: RLS `authenticated insert own scores`** con `auth.uid() = user_id`. `user_id` sigue nullable solo por las filas históricas. Descartado: `NOT NULL` + borrar datos (destructivo) y dejar insert público (spam sin freno).
- **Sí: `proxy.ts` de refresco de sesión.** Patrón oficial de `@supabase/ssr`; decisión del usuario. Descartado: solo cliente (sesión podría expirar sin refresco SSR).
- **Sí: `/auth/callback` como route handler** con `exchangeCodeForSession` (flujo PKCE), también para verificación y recuperación; `/auth/reset-password` recibe ya la sesión de recuperación en lugar de leer el token a mano.
- **Sí: mensajes de error propios en español** en vez de los textos crudos de Supabase.
- **No: perfil editable, unicidad de username, vinculación de identidades.** Specs futuros.
- **No: páginas protegidas.** Solo el guardado de score exige sesión.

---

## Riesgos identificados

| Riesgo                                                                     | Mitigación                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Open redirect vía `next` en `/auth/callback`                               | Aceptar solo rutas relativas (`/…`, nunca `//`); fallback a `/`.                                   |
| Redirect URLs mal configuradas en Supabase (local vs producción)           | Paso 1 lista ambas; criterio de aceptación de OAuth y verificación en cada entorno.                |
| `proxy.ts` + `cacheComponents`/`partialPrefetching` (flags experimentales) | Leer `proxy.md` antes; matcher que excluya estáticos; probar navegación con sesión tras el paso 4. |
| Email del mismo usuario por Google y GitHub crea identidades separadas     | Aceptado; vinculación manual fuera de scope.                                                       |
| Límite de envío de correos del SMTP por defecto de Supabase                | Aceptado en desarrollo; SMTP propio (p. ej. Resend) en producción, fuera de este spec.             |
| Parpadeo "Iniciar Sesión" → avatar al hidratar                             | `loading` en `UserContext`; Nav no renderiza el estado hasta resolverlo.                           |
| Fallo de red al insertar score con sesión                                  | `insertScore` sigue sin lanzar; la UI no muestra error (comportamiento SPEC 06).                   |

---

## What is **not** in this spec

- Edición de perfil, cambio de nombre o avatar propio.
- Tabla `profiles` y unicidad de nombres.
- Magic link, OTP, MFA, borrar cuenta.
- Migración de scores históricos sin `user_id`.
- Guardado local de scores para invitados.
- Anti-cheat / rate limiting de scores.
- Rutas protegidas por sesión.
- SMTP propio para correos de producción.

Cada uno, si llega, va en su propio spec.
