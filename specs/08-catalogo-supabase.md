# SPEC 08 — Catálogo de Juegos desde Supabase

> **Status:** Borrador
> **Depends on:** SPEC 06
> **Date:** 2026-11-13
> **Objetivo:** Mover el catálogo de juegos de `lib/data.ts` a la tabla `games` de Supabase, para que añadir un juego nuevo no requiera tocar código ni hacer deploy.

---

## Scope

**In:**

- Migración SQL que extiende la tabla `games` con los campos del catálogo: `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`
- Seed de los 9 juegos actuales de `lib/data.ts` en Supabase
- `fetchCatalog()` en `lib/supabase/leaderboard.ts` — retorna `Game[]` con fallback a `GAMES` de `lib/data.ts`
- Actualizar `app/biblioteca/page.tsx` para usar `fetchCatalog()` en lugar de `GAMES`
- Actualizar `app/page.tsx` para usar `fetchCatalog()` en el preview de la home
- Actualizar `app/juego/[id]/page.tsx` para resolver el juego desde Supabase
- Actualizar `app/juego/[id]/jugar/page.tsx` para resolver el juego desde Supabase
- RLS: política de `SELECT` público en `games` ya existe (SPEC 06); añadir columnas no requiere política nueva

**Out of scope:**

- Eliminar `lib/data.ts` o el array `GAMES` (permanece como fallback)
- Eliminar `CATS` de `lib/data.ts` (se mantiene como fallback)
- Formulario de alta de juegos en la UI (el INSERT sigue siendo manual vía MCP o SQL)
- Calcular `best` desde la tabla `scores` (campo estático por ahora)
- Calcular `plays` desde contadores reales (campo estático por ahora)
- Tiempo real / suscripciones Supabase
- Paginación del catálogo
- Imágenes de portada en Supabase Storage

---

## Data model

### Extensión de la tabla `games`

```sql
ALTER TABLE games
  ADD COLUMN short  text NOT NULL DEFAULT '',
  ADD COLUMN long   text NOT NULL DEFAULT '',
  ADD COLUMN cat    text NOT NULL DEFAULT 'ARCADE',
  ADD COLUMN cover  text NOT NULL DEFAULT '',
  ADD COLUMN color  text NOT NULL DEFAULT 'cyan',
  ADD COLUMN best   integer NOT NULL DEFAULT 0,
  ADD COLUMN plays  text NOT NULL DEFAULT '0';
```

Después del `ALTER`, la tabla completa queda:

| Columna  | Tipo        | Descripción                                            |
| -------- | ----------- | ------------------------------------------------------ |
| `id`     | uuid PK     | Clave interna (no expuesta en la UI)                   |
| `slug`   | text UNIQUE | Identificador público; mapea a `Game.id`               |
| `name`   | text        | Título en mayúsculas; mapea a `Game.title`             |
| `active` | boolean     | Si aparece en el catálogo (filtro de visibilidad)      |
| `short`  | text        | Descripción corta para las tarjetas                    |
| `long`   | text        | Descripción larga para la ficha del juego              |
| `cat`    | text        | Categoría: `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`     |
| `cover`  | text        | Nombre de la clase CSS de portada (e.g. `cover-rocas`) |
| `color`  | text        | Color neon: `cyan`, `magenta`, `yellow`, `green`       |
| `best`   | integer     | Mejor puntuación conocida (dato estático por ahora)    |
| `plays`  | text        | Conteo de partidas formateado (e.g. `12.4K`)           |

### `fetchCatalog()` — firma exportada

```ts
// lib/supabase/leaderboard.ts

// Retorna Game[] desde Supabase. Si falla, retorna GAMES de lib/data.ts.
export async function fetchCatalog(): Promise<Game[]>;
```

El mapping de columnas a interfaz `Game`:

```ts
// slug    → id
// name    → title
// short   → short
// long    → long
// cat     → cat
// cover   → cover
// color   → color (cast a "cyan"|"magenta"|"yellow"|"green")
// best    → best
// plays   → plays
// (active filtra: WHERE active = true ORDER BY name)
```

`CATS` (array de categorías para el filtro de biblioteca) se deriva del catálogo retornado:

```ts
const cats = ["TODOS", ...new Set(games.map((g) => g.cat)).values()];
```

---

## Plan de implementación

1. **Crear migración SQL** — Crear `supabase/migrations/20261113000001_catalog_fields.sql` con:
   - `ALTER TABLE games ADD COLUMN...` (ver Data model)
   - `UPDATE games SET ... WHERE slug = '...'` para los 9 juegos ya registrados en Supabase (`asteroides` y cualquier otro insertado previamente)
   - `INSERT INTO games (...) VALUES (...)` para los juegos del catálogo que aún no estén en la tabla

   Los 9 juegos a sembrar (valores extraídos de `lib/data.ts`):

   | slug          | name          | cat     | color   | cover          |
   | ------------- | ------------- | ------- | ------- | -------------- |
   | bloque-buster | BLOQUE BUSTER | ARCADE  | cyan    | cover-bricks   |
   | caida         | CAÍDA         | PUZZLE  | magenta | cover-tetro    |
   | serpentina    | SERPENTINA    | ARCADE  | green   | cover-snake    |
   | gloton        | GLOTÓN        | ARCADE  | yellow  | cover-glot     |
   | invasores     | INVASORES     | SHOOTER | green   | cover-invaders |
   | asteroides    | ASTEROIDES    | SHOOTER | yellow  | cover-rocas    |
   | rocas         | ROCAS         | SHOOTER | yellow  | cover-rocas    |
   | ranaria       | RANARIA       | ARCADE  | green   | cover-rana     |
   | duelo-pixel   | DUELO PIXEL   | VERSUS  | cyan    | cover-duelo    |

   Verificación: el archivo de migración existe y el SQL es sintácticamente válido.

2. **Aplicar migración** — `mcp__supabase__apply_migration`. Verificar con `mcp__supabase__execute_sql SELECT slug, name, cat FROM games ORDER BY name` que los 9 juegos tienen todos los campos.

3. **Crear `fetchCatalog()`** en `lib/supabase/leaderboard.ts`:
   - `SELECT slug, name, short, long, cat, cover, color, best, plays FROM games WHERE active = true ORDER BY name`
   - Mapea cada fila a `Game` (ver mapping de columnas).
   - En caso de error: `console.error`, retorna `GAMES` de `lib/data.ts` (fallback completo).
   - Verificación: TypeScript compila; `npm run lint` pasa.

4. **Actualizar `app/biblioteca/page.tsx`** — Reemplazar la importación `GAMES` y `CATS` de `lib/data.ts`:
   - Si el componente es `'use client'`: llamar `fetchCatalog()` en un `useEffect` inicial, guardar en estado; mientras carga usar `GAMES` como valor inicial (evita flash vacío).
   - Si el componente es Server Component: llamar `await fetchCatalog()` directamente en el cuerpo del componente.
   - Derivar `CATS` del array retornado: `['TODOS', ...new Set(games.map(g => g.cat))]`.
   - Verificación: `/biblioteca` carga y muestra los 9 juegos; el filtro por categoría funciona.

5. **Actualizar `app/page.tsx`** — Reemplazar `GAMES.slice(0, 6)`:
   - Si es Server Component: `const games = await fetchCatalog(); games.slice(0, 6)`.
   - Si tiene partes client: pasar el catálogo como prop desde el layout o un server wrapper.
   - Verificación: la home muestra los primeros 6 juegos del catálogo de Supabase.

6. **Actualizar `app/juego/[id]/page.tsx`** — Reemplazar `GAMES.find(g => g.id === id)`:
   - `const games = await fetchCatalog(); const game = games.find(g => g.id === id)`.
   - Si `game` es `undefined` → `notFound()` (mismo comportamiento que hoy).
   - Verificación: `/juego/asteroides`, `/juego/caida` etc. cargan sus fichas correctamente.

7. **Actualizar `app/juego/[id]/jugar/page.tsx`** — Mismo patrón que el paso 6:
   - `const games = await fetchCatalog(); const game = games.find(g => g.id === id)`.
   - Si `game` es `undefined` → `notFound()`.
   - Verificación: `/juego/asteroides/jugar` carga el canvas; `/juego/caida/jugar` sigue mostrando el mock.

8. **Verificar build completo** — `npm run build` y `npm run lint` pasan sin errores. Verificación: salida limpia de ambos comandos.

---

## Criterios de aceptación

- [ ] `games` en Supabase tiene las columnas `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`
- [ ] Los 9 juegos del catálogo tienen todos los campos con los valores correctos de `lib/data.ts`
- [ ] `fetchCatalog()` retorna `Game[]` ordenado por nombre cuando Supabase está disponible
- [ ] Si Supabase falla, `fetchCatalog()` retorna `GAMES` de `lib/data.ts` sin romper la UI
- [ ] `/biblioteca` muestra los 9 juegos y el filtro por categoría funciona
- [ ] `/` (home) muestra el preview de juegos desde Supabase
- [ ] `/juego/asteroides` y el resto de fichas cargan correctamente
- [ ] `/juego/asteroides/jugar` sigue cargando el canvas sin cambios
- [ ] Añadir un juego nuevo en Supabase (`INSERT INTO games ...`) lo hace aparecer en `/biblioteca` sin deploy
- [ ] `lib/data.ts` y el array `GAMES` siguen existiendo (no se eliminan)
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `npm run lint` pasa sin errores

---

## Decisiones

- **Extender `games` en lugar de nueva tabla** — Los campos del catálogo pertenecen semánticamente al juego. Una tabla separada (`game_catalog`) añade un join sin beneficio para el volumen actual.
- **`slug` como identificador público** — La tabla usa UUID interno, pero el código siempre usa `slug` (que mapea a `Game.id`). Coherente con SPEC 06; no se expone el UUID en URLs ni en el cliente.
- **Fallback a `lib/data.ts`** — Si Supabase está caído, el catálogo estático garantiza que la plataforma siga funcionando. `lib/data.ts` no se elimina en este spec.
- **`best` y `plays` como campos estáticos** — Calcularlos desde `scores` requiere queries extra y lógica adicional. Para el MVP, se copian los valores del array estático. Un spec futuro puede hacer `best` = `MAX(score) WHERE game_slug = slug` y `plays` = `COUNT(*)`.
- **`CATS` derivado del catálogo** — En lugar de mantener un array estático paralelo, las categorías se extraen de los juegos retornados. Elimina una fuente de desincronización.
- **`name` → `title` en el mapping** — La columna SQL se llama `name` (coherente con SPEC 06); la interfaz TypeScript usa `title`. El mapping ocurre en `fetchCatalog()`.
- **`long` como nombre de columna SQL** — PostgreSQL lo admite sin comillas; es consistente con la interfaz TypeScript. Si alguna herramienta lo rechaza, alternativa inmediata: renombrar a `description`.
- **No eliminar importaciones de `lib/data.ts` en este spec** — Los archivos pueden seguir importando `seededScores`, `ScoreRow` y `Game` (tipo). Solo se elimina el consumo de `GAMES` como fuente de datos real.

---

## Riesgos

| Riesgo                                                                | Mitigación                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `fetchCatalog()` tarda y el usuario ve la biblioteca vacía            | Inicializar estado con `GAMES` de `lib/data.ts`; reemplazar cuando Supabase responda                                      |
| Juego en Supabase con `active = false` desaparece del catálogo        | Es el comportamiento esperado — permite ocultar un juego sin deploy                                                       |
| Desincronización entre `lib/data.ts` y Supabase durante la transición | El fallback es idempotente; si Supabase falla se muestra el estado estático sin errores                                   |
| `color` en Supabase con valor inválido (no es el union type)          | Castear con `as Game['color']` en el mapping; si el valor es inválido, el tipo no explota en runtime (solo en TypeScript) |
