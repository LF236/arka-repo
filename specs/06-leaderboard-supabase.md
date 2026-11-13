# SPEC 06 — Leaderboard y Tabla de Juegos con Supabase

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 05
> **Date:** 2026-11-13
> **Objective:** Conectar el Salón de la Fama y la ficha de Asteroides con Supabase, mediante tablas `games`+`scores`, leaderboard híbrido filtrado a juegos reales, y guardado de puntuaciones con persistencia del nombre en localStorage.

---

## Scope

**In:**

- `supabase/migrations/20261113000000_leaderboard.sql` — crear tablas `games` y `scores`, RLS, seed de `asteroides`
- `lib/supabase/leaderboard.ts` — funciones de lectura/escritura: `fetchRealGames`, `fetchTopScores`, `insertScore`
- `app/salon/page.tsx` — tabs dinámicos desde Supabase (solo juegos activos); vista global y por juego con datos reales; fallback a `seededScores` si Supabase falla
- `app/juego/[id]/page.tsx` — leaderboard lateral cargado desde Supabase para juegos reales; fallback a `seededScores` si Supabase falla
- `components/games/asteroides/index.tsx` — guardar score en Supabase + localStorage; pre-llenar nombre desde localStorage `av_player_name`

**Out of scope:**

- Autenticación (user_id permanece `null` por ahora)
- Edición o eliminación de scores desde la UI
- Paginación del leaderboard (top 12 es suficiente)
- Scores de juegos mock (bloque-buster, caida, serpentina, etc.)
- Tiempo real / suscripciones Supabase
- Eliminar `seededScores` de `lib/data.ts` (se mantiene como fallback; se borra en spec futuro)
- Eliminar juegos mock de `lib/data.ts` (el catálogo no cambia)
- Controles de moderación de scores

---

## Data model

### Tabla `games`

```sql
CREATE TABLE games (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  active      boolean NOT NULL DEFAULT true
);
```

Seed inicial:

```sql
INSERT INTO games (slug, name, active) VALUES ('asteroides', 'ASTEROIDES', true);
```

### Tabla `scores`

```sql
CREATE TABLE scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug   text NOT NULL REFERENCES games(slug),
  player_name text NOT NULL,
  score       integer NOT NULL CHECK (score >= 0),
  user_id     uuid REFERENCES auth.users(id),   -- null mientras no haya auth
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### RLS

```sql
ALTER TABLE games  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read games"  ON games  FOR SELECT USING (true);
CREATE POLICY "public read scores" ON scores FOR SELECT USING (true);
CREATE POLICY "public insert scores" ON scores FOR INSERT WITH CHECK (true);
```

### `lib/supabase/leaderboard.ts` — interfaz exportada

```ts
// Lee slugs activos de la tabla games
export async function fetchRealGames(): Promise<string[]>;

// Lee top scores globales (sin gameSlug) o de un juego (con gameSlug)
// Retorna [] si Supabase falla — el llamador decide el fallback
export async function fetchTopScores(
  gameSlug?: string,
  limit?: number,
): Promise<ScoreRow[]>; // ScoreRow importado de lib/data.ts

// Inserta una puntuación; no lanza si falla (error silencioso)
export async function insertScore(
  gameSlug: string,
  playerName: string,
  score: number,
): Promise<void>;
```

La función global `fetchTopScores()` (sin `gameSlug`) retorna scores de todos los juegos activos, con un campo adicional `game` para mostrar el nombre del juego en la tabla global.

### localStorage keys

| Key                    | Contenido                                                            |
| ---------------------- | -------------------------------------------------------------------- |
| `av_player_name`       | Último nombre escrito por el jugador (string)                        |
| `av_scores_asteroides` | Cache local de scores de Asteroides (array JSON — formato existente) |

---

## Implementation plan

1. **Crear migración SQL** — Crear el archivo `supabase/migrations/20261113000000_leaderboard.sql` con:
   - Crear tabla `games`
   - Crear tabla `scores` con FK a `games.slug`
   - Habilitar RLS y crear las tres políticas
   - Seed: `INSERT INTO games (slug, name, active) VALUES ('asteroides', 'ASTEROIDES', true)`

   Verificación: el archivo existe y el SQL es sintácticamente válido.

2. **Aplicar migración a Supabase** — Ejecutar la migración via MCP (`mcp__supabase__apply_migration`). Verificar con `mcp__supabase__list_tables` que `games` y `scores` aparecen. Verificar con `mcp__supabase__execute_sql` que la fila de `asteroides` existe en `games`.

3. **Crear `lib/supabase/leaderboard.ts`** — Implementar las tres funciones exportadas:
   - `fetchRealGames()`: `SELECT slug FROM games WHERE active = true ORDER BY name`. Retorna `[]` en error.
   - `fetchTopScores(gameSlug?, limit = 12)`:
     - Sin `gameSlug`: `SELECT s.*, g.name AS game FROM scores s JOIN games g ON g.slug = s.game_slug ORDER BY s.score DESC LIMIT limit`
     - Con `gameSlug`: `SELECT * FROM scores WHERE game_slug = ? ORDER BY score DESC LIMIT limit`
     - Mapea a `ScoreRow` (rank calculado en JS, date formateado `DD/MM/YYYY` desde `created_at`)
     - Retorna `[]` en error (el llamador decide si muestra fallback)
   - `insertScore(gameSlug, playerName, score)`: `INSERT INTO scores (game_slug, player_name, score, user_id) VALUES (?, ?, ?, null)`. Captura error con `console.error` sin relanzar.

   Verificación: TypeScript compila sin errores; `npm run lint` pasa.

4. **Actualizar `app/salon/page.tsx`** — Cambios de comportamiento:
   - **Tabs:** en lugar de `GAMES.map(...)`, obtener tabs desde `fetchRealGames()` en un `useEffect` inicial. Fallback a `['asteroides']` si retorna `[]`.
   - **Vista global (tab especial "GLOBAL"):** primer tab por defecto, carga `fetchTopScores()` sin filtro; la tabla muestra columna adicional "JUEGO" antes de "JUGADOR". Fallback a `seededScores(0, 12)` si Supabase falla.
   - **Vista por juego (demás tabs):** carga `fetchTopScores(gameSlug)`. Si retorna `[]` (vacío real), mostrar estado vacío "Sin puntuaciones aún". Si Supabase falla, usar `seededScores(tab.length * 23 + 7, 12)`.
   - El pódium y la tabla de ranks se mantienen con el mismo markup; ajustar columnas para la vista global.
   - Eliminar lógica de `youRank`/`youScore` hardcodeada (no hay auth aún).

   Verificación: `/salon` carga y muestra tab "GLOBAL" con columna de juego; tab "ASTEROIDES" muestra scores filtrados; los juegos mock no aparecen en tabs.

5. **Actualizar `app/juego/[id]/page.tsx`** — En `GameDetailContent`:
   - Al montar (useEffect), verificar si `id` está en `fetchRealGames()`.
   - Si sí: cargar scores con `fetchTopScores(id, 10)`. Si retorna `[]`, mostrar "Sin puntuaciones aún".
   - Si no (juego mock) o si Supabase falla: usar `seededScores(id.length * 17 + 3, 10)` como antes.
   - Estado de carga: mientras se resuelve, mostrar los scores actuales (seededScores) y reemplazar si Supabase responde.

   Verificación: `/juego/asteroides` muestra leaderboard de Supabase (vacío inicialmente con mensaje); `/juego/rocas` sigue mostrando seededScores sin cambios.

6. **Actualizar `components/games/asteroides/index.tsx`** — Tres cambios:
   - **Pre-llenado del nombre:** al abrir el modal de game over, leer `localStorage.getItem('av_player_name')` y usarlo como valor inicial del input `name`. Si no existe, usar `''` (no `'INVITADO'`).
   - **Persistencia del nombre mientras escribe:** `onChange` del input actualiza estado React; al guardar, escribir `localStorage.setItem('av_player_name', name)`.
   - **Guardado dual:** al presionar "GUARDAR PUNTUACIÓN":
     1. Llamar `insertScore('asteroides', name, score)` — await, no bloquear UI si falla.
     2. Leer cache local `av_scores_asteroides`, añadir la nueva entrada, guardar de vuelta.
     3. Marcar `saved = true`, mostrar confirmación.

   Verificación: tras una partida, el score aparece en Supabase con `mcp__supabase__execute_sql SELECT * FROM scores`; el modal pre-llena el nombre en la siguiente partida.

7. **Verificar build** — `npm run build` y `npm run lint` pasan sin errores TypeScript. Verificación: salida limpia de ambos comandos.

---

## Acceptance criteria

- [X] Tablas `games` y `scores` existen en Supabase con RLS habilitado (políticas de SELECT público y INSERT público en `scores`)
- [X] `games` contiene la fila `{slug: 'asteroides', name: 'ASTEROIDES', active: true}`
- [X] `/salon` muestra tab "GLOBAL" por defecto con scores de todos los juegos reales, columna de juego visible
- [X] `/salon` muestra tab "ASTEROIDES" que filtra scores por `game_slug = 'asteroides'`
- [X] Los juegos mock (bloque-buster, caida, serpentina, etc.) NO aparecen en ningún tab de `/salon`
- [X] `/salon` con Supabase vacío muestra "Sin puntuaciones aún" (no seededScores)
- [X] `/salon` con Supabase caído muestra seededScores como fallback visible (no pantalla rota)
- [X] `/juego/asteroides` muestra leaderboard lateral con datos de Supabase; si vacío muestra estado vacío; si Supabase falla muestra seededScores
- [X] `/juego/rocas` y otros juegos mock mantienen comportamiento actual con seededScores (sin cambios)
- [X] El catálogo (`/`) y biblioteca muestran todos los juegos de `lib/data.ts` sin cambios
- [X] Al finalizar partida de Asteroides, el modal pre-llena el nombre desde localStorage `av_player_name`
- [X] Al guardar puntuación: fila insertada en `scores` de Supabase + cache en `av_scores_asteroides` + nombre en `av_player_name`
- [X] Fallo de insert en Supabase no bloquea la UI ni muestra error al jugador
- [X] `npm run build` completa sin errores TypeScript
- [X] `npm run lint` pasa sin errores

---

## Decisions

- **Sí: `game_slug text` en lugar de FK UUID** — La tabla `scores` referencia `games.slug` directamente. Mantiene el código legible y evita joins complejos. FK text (`REFERENCES games(slug)`) garantiza integridad sin necesidad de resolver UUIDs en el cliente.
- **Sí: `user_id nullable`** — No se requiere autenticación para jugar y guardar puntuaciones. El campo existe para cuando llegue el spec de auth; el INSERT actual pasa `null` explícitamente.
- **Sí: tab "GLOBAL" como vista principal** — El usuario confirmó que global = top scores de todos los juegos reales mezclados. Es el ranking más valioso para la portada del salón.
- **Sí: fallback a `seededScores` en caso de fallo** — Degradación silenciosa: el usuario ve datos de ejemplo pero la app no rompe. La distinción entre "vacío real" y "fallo" se maneja con el valor de retorno de `fetchTopScores` (`[]` = vacío/fallo).
- **Sí: guardado dual Supabase + localStorage** — El jugador no pierde su score si Supabase falla temporalmente. LocalStorage actúa como cache offline.
- **No: RLS restrictiva en scores** — Por ahora cualquiera puede insertar scores sin validación de identidad. Se endurecerá cuando llegue el spec de auth con `user_id NOT NULL`.
- **No: eliminar `seededScores` en este spec** — Se mantiene como fallback. Se borra cuando Supabase tenga suficientes datos reales (spec futuro).
- **No: paginación** — Top 12 es suficiente para el MVP. No hay más usuarios que justifiquen paginación ahora.
- **Decisión rápida aceptada:** el schema de BD fue confirmado por el usuario sin iteración extendida.

---

## Risks

| Riesgo                                                              | Mitigación                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `fetchRealGames()` tarda y el usuario ve tabs vacíos mientras carga | Mostrar tabs con skeleton o fallback inmediato `['asteroides']` antes de que resuelva la promise |
| Scores duplicados si el usuario presiona "GUARDAR" varias veces     | Deshabilitar el botón tras el primer click exitoso (estado `saved = true`)                       |
| `scores` recibe spam de puntuaciones falsas (sin auth)              | Aceptado por ahora; mitigación futura con auth y rate limiting en Supabase                       |
| `created_at` en UTC confunde al formatearlo como fecha local        | Formatear con `toLocaleDateString('es-ES')` al mapear `ScoreRow.date`                            |
