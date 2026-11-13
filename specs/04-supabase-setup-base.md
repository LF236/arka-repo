# SPEC 04 — Supabase: Setup Base

> **Status:** Aprobbed
> **Depends on:** SPEC 01
> **Date:** 2026-11-12
> **Objective:** Instalar y configurar el cliente de Supabase (browser + server) en la aplicación Next.js, con variables de entorno documentadas, listo para ser consumido por specs futuros de autenticación y base de datos.

---

## Scope

**In:**

- `package.json` — añadir `@supabase/supabase-js` y `@supabase/ssr`
- `lib/supabase/client.ts` — cliente de navegador con `createBrowserClient`
- `lib/supabase/server.ts` — cliente de servidor async con `createServerClient` y cookies de Next.js
- `.env.local` — variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (no se commitea)
- `.env.template` — documentar las dos variables nuevas

**Out of scope:**

- Autenticación (login/registro/sesiones) — spec separado
- Tablas o migraciones en la base de datos — spec separado
- Middleware de Supabase (refresco automático de sesión) — llega con el spec de auth
- Service role key (solo necesaria para operaciones admin server-side)
- Realtime / suscripciones
- Row Level Security (RLS)
- Verificación de conexión con query real

---

## Data model

No se introducen tablas ni estructuras de datos. Este spec no toca `lib/data.ts`.

Variables de entorno que se añaden:

| Variable                               | Visibilidad                    | Descripción                                                            |
| -------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Pública (navegador + servidor) | URL del proyecto Supabase (`https://<ref>.supabase.co`)                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública (navegador + servidor) | Clave publicable del proyecto; diseñada para exponerse; RLS la protege |

Ambas usan el prefijo `NEXT_PUBLIC_` porque tanto el cliente de browser como el de server las leen, y Supabase diseña estas claves para ser públicas (la seguridad real viene de las políticas RLS en la base de datos).

---

## Implementation plan

1. **Instalar paquetes** — `npm install @supabase/supabase-js @supabase/ssr`. Verificación: ambos aparecen en `dependencies` de `package.json`.

2. **Añadir variables de entorno** — En `.env.local`, añadir:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

   En `.env.template`, añadir las mismas dos líneas con valor vacío como documentación. Verificación: `.env.template` tiene ambas entradas; `.env.local` no está en git.

3. **Crear `lib/supabase/client.ts`** — Cliente de navegador con `createBrowserClient`. Exporta una función `createClient()` (no una instancia directa, para que sea compatible con el patrón de `@supabase/ssr`). Verificación: el archivo existe y TypeScript no reporta errores.

4. **Crear `lib/supabase/server.ts`** — Cliente de servidor async con `createServerClient`. Lee las cookies de Next.js con `cookies()` de `next/headers`. Implementa `getAll()` y `setAll()` en el objeto `cookies` del cliente. `setAll` usa try/catch vacío porque los Server Components no pueden mutar cookies (solo los Route Handlers y Server Actions pueden). Exporta `createClient()` async. Verificación: el archivo existe y TypeScript no reporta errores.

5. **Verificar build** — `npm run build` y `npm run lint` pasan sin errores. Verificación: salida de ambos comandos sin errores.

---

## Acceptance criteria

- [X] `@supabase/supabase-js` y `@supabase/ssr` están en `package.json` bajo `dependencies`
- [X] `lib/supabase/client.ts` existe y exporta una función `createClient` que retorna un `SupabaseBrowserClient`
- [X] `lib/supabase/server.ts` existe y exporta una función `async createClient` que retorna un `SupabaseServerClient`
- [X] `.env.template` contiene las entradas `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`
- [X] `.env.local` tiene los valores reales (no está commiteado)
- [X] Ninguna página existente (`/`, `/biblioteca`, `/acerca`, `/juego/[id]`) rompe con los cambios
- [X] `npm run build` completa sin errores TypeScript
- [X] `npm run lint` pasa sin errores

---

## Decisions

- **Sí: `@supabase/ssr` en lugar de `@supabase/auth-helpers-nextjs`** — `auth-helpers-nextjs` está deprecado. `@supabase/ssr` es el paquete oficial y actual para Next.js App Router.
- **Sí: `NEXT_PUBLIC_` en ambas variables** — La URL y la publishable key están diseñadas por Supabase para ser públicas; la seguridad real viene de RLS. Usar prefijo `NEXT_PUBLIC_` evita duplicar variables (una para browser, otra para server).
- **Sí: función `createClient()` en lugar de instancia exportada directamente** — `@supabase/ssr` requiere acceder a las cookies por llamada, no una sola vez al arrancar. Una función garantiza que cada request del servidor obtiene las cookies frescas.
- **No: service role key en este spec** — Solo es necesaria para operaciones admin que saltean RLS. Se añade si y cuando haya un spec que la requiera.
- **No: middleware en este spec** — El middleware de Supabase refresca tokens de sesión automáticamente. No es necesario hasta el spec de autenticación.
- **No: verificación con query real** — La conexión se confirma cuando el primer spec que use el cliente haga una query real. Añadir una llamada de prueba aquí añade complejidad sin valor duradero.

---

## Risks

| Riesgo                                                                                                                                           | Mitigación                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ausentes en producción bloquean silenciosamente cualquier llamada a Supabase | Documentar en `.env.template`; el operador de despliegue debe configurarlas en las variables de entorno del hosting |
| `cookies()` de `next/headers` cambia de API en Next.js 16                                                                                        | Leer `node_modules/next/dist/docs/` antes de implementar `server.ts` para confirmar la firma exacta                 |
