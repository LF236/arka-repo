---
name: add-game
description: Genera el spec combinado (integración de juego canvas + leaderboard) para incorporar un nuevo juego a Arcade Vault. Solo crea el spec; no implementa.
disable-model-invocation: true
argument-hint: "slug o carpeta de referencia (ej: 03-tetris)"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /add-game — Diseñador de spec para nuevo juego en Arcade Vault

## Contexto de sesión

Fecha de hoy (úsala en el encabezado del spec, nunca la inventes):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe aún"`

Juegos de referencia disponibles en references/started-games/:
!`ls references/started-games/ 2>/dev/null || echo "No hay carpeta de referencias"`

---

Este skill genera un **spec combinado** (integración del juego + leaderboard) para añadir un nuevo juego a Arcade Vault. **No escribes código aquí.** Tu trabajo es clarificar qué juego se va a integrar, qué datos necesita, y producir el spec en `specs/` listo para que `/spec-impl` lo ejecute.

## Filosofía

Arcade Vault tiene un patrón consolidado: el componente asteroides en `components/games/asteroides/` es la implementación canónica, y las páginas `/salon` y `/juego/[id]/page.tsx` ya manejan cualquier juego registrado en Supabase sin modificación. Añadir un juego nuevo es un proceso repetible; este skill codifica ese proceso como spec para que sea trazable y ejecutable de forma consistente.

Lee `.claude/skills/spec/template.md` antes de escribir. Esa es la estructura que todo spec de este proyecto debe seguir.

## Flujo del comando

Sigue las cuatro fases en orden. Las respuestas deben estar en español, igual que el resto de specs del proyecto.

### Fase 1 — Leer contexto

Antes de preguntar nada al usuario, lee estos archivos:

1. `CLAUDE.md` — convenciones del proyecto.
2. `.claude/skills/spec/template.md` — estructura obligatoria del spec.
3. `lib/data.ts` — interfaz `Game`, `ScoreRow`, lista de juegos registrados.
4. `specs/05-asteroides-juego-canvas.md` — patrón de integración de juego canvas en Next.js.
5. `specs/06-leaderboard-supabase.md` — patrón de leaderboard con Supabase.
6. Si `$ARGUMENTS` coincide con una carpeta en `references/started-games/`, lee su `README.md` y/o `CLAUDE.md` para entender el juego de referencia.

Si `$ARGUMENTS` está vacío, pide al usuario una descripción breve del juego que quiere integrar.

### Fase 2 — Clarificar mediante preguntas

Pregunta en un solo bloque usando `AskUserQuestion`. Espera las respuestas antes de continuar.

Preguntas que siempre debes hacer (omite las que ya puedas inferir de la carpeta de referencia o de `$ARGUMENTS`):

1. **Slug del juego** — kebab-case en minúsculas, e.g. `tetris`. Será el `id` en `lib/data.ts`, el nombre de la carpeta del componente, y el slug en Supabase.
2. **Nombre display** — en MAYÚSCULAS, e.g. `TETRIS`. Es el `title` en `lib/data.ts`.
3. **Categoría** — `ARCADE`, `PUZZLE`, `SHOOTER`, o `VERSUS`.
4. **Color neon** — `cyan`, `magenta`, `yellow`, o `green`. Recomendación: elige el color menos usado entre los juegos existentes en `lib/data.ts`.
5. **Descripción corta** — una línea para la biblioteca de juegos (`short` en `lib/data.ts`).
6. **Descripción larga** — párrafo de gameplay para la ficha del juego (`long` en `lib/data.ts`).
7. **Carpeta de referencia** — cuál de las carpetas en `references/started-games/` contiene el código fuente del juego, o `ninguna` si se escribe desde cero.
8. **Mecánicas de leaderboard** — ¿el score se calcula igual que en asteroides (puntos acumulados)? ¿Hay algo especial: vidas restantes como bonus, tiempo, niveles? Esto afecta cómo el componente llama a `insertScore`.

Usa preguntas concretas, no abiertas. Cuando ofrezcas opciones, indica cuál recomiendas y por qué.

### Fase 3 — Escribir el spec

Una vez cerrada la Fase 2, escribe el spec completo de una vez si tienes toda la información. No vayas sección por sección a menos que falte información crítica.

El spec cubre **juego + leaderboard en un solo archivo**. Estructura obligatoria:

#### Encabezado

```
# SPEC NN — [Nombre]: Integración del Juego y Leaderboard

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06
> **Date:** [fecha del contexto de sesión]
> **Objetivo:** Una frase. Integrar el juego [Nombre] (canvas vanilla JS) en la plataforma Arcade Vault con leaderboard conectado a Supabase.
```

#### Scope

**In:**

- Entrada en `lib/data.ts` con todos los campos de la interfaz `Game`
- `components/games/[slug]/game.ts` — adaptación de la lógica del juego de referencia, exponiendo `initGame(canvas, callbacks): GameController`
- `components/games/[slug]/index.tsx` — componente React con HUD, modal de game over, guardado de score (Supabase + localStorage), pre-llenado de nombre desde `av_player_name`
- `app/juego/[slug]/jugar/page.tsx` — ruta de juego con dynamic import del componente
- INSERT en Supabase tabla `games`: `{ slug, name: '[NOMBRE]', active: true }`

**Out of scope:**

- Diseño de lógica de juego (proviene del código de referencia en `references/started-games/`)
- Activos gráficos o sonidos (se toman de la referencia o se crean fuera del spec)
- Autenticación (`user_id` permanece `null`)
- Cambios en `app/salon/page.tsx` o `app/juego/[id]/page.tsx` (ya manejan cualquier juego real de Supabase sin modificación)
- Paginación del leaderboard
- Moderación de scores

#### Data model

Muestra la entrada `Game` concreta con los valores reales:

```ts
// lib/data.ts — nueva entrada
{
  id: '[slug]',
  title: '[NOMBRE]',
  short: '[descripción corta]',
  long: '[descripción larga]',
  cat: '[CATEGORÍA]',
  cover: 'cover-[slug]',
  color: '[color]',
  best: 0,
  plays: '0',
}
```

Muestra el SQL de INSERT:

```sql
INSERT INTO games (slug, name, active) VALUES ('[slug]', '[NOMBRE]', true);
```

Si el juego tiene callbacks distintos a los de asteroides (`onScore`, `onLives`, `onLevel`, `onGameOver`), documenta la variación. Si son iguales, indícalo explícitamente.

#### Plan de implementación

6 pasos, cada uno verificable y committable:

1. **Añadir entrada en `lib/data.ts`** — Agregar el objeto `Game` al array `GAMES`. Verificación: `npm run build` compila.
2. **Crear `components/games/[slug]/game.ts`** — Adaptar el código de `references/started-games/[carpeta]/game.js` a TypeScript, exponiendo `initGame(canvas, callbacks): GameController`. Verificación: no hay errores de tipos.
3. **Crear `components/games/[slug]/index.tsx`** — Componente React siguiendo el patrón de `components/games/asteroides/index.tsx`: refs para canvas y controller, callbacks de estado, HUD externo, modal de game over con `insertScore` y cache en `av_scores_[slug]`, pre-llenado de nombre desde `av_player_name`. Verificación: el componente renderiza sin errores.
4. **Crear `app/juego/[slug]/jugar/page.tsx`** — Dynamic import del componente con `{ ssr: false }`, igual que `app/juego/asteroides/jugar/page.tsx`. Verificación: la ruta `/juego/[slug]/jugar` carga sin errores de SSR.
5. **Registrar en Supabase** — Ejecutar el INSERT en la tabla `games` via MCP `mcp__supabase__execute_sql`. Verificación: `SELECT * FROM games WHERE slug = '[slug]'` devuelve la fila.
6. **Verificar integración completa** — `npm run build` y `npm run lint` pasan; `/juego/[slug]/jugar` carga y registra scores; `/salon` muestra tab `[NOMBRE]`; `/juego/[slug]` muestra leaderboard lateral; los juegos existentes no se rompen.

#### Criterios de aceptación

Checklist booleano. Adaptar los valores concretos al juego:

- [ ] `lib/data.ts` incluye la entrada `{ id: '[slug]', ... }` con todos los campos
- [ ] `components/games/[slug]/game.ts` exporta `initGame` con la firma `GameController`
- [ ] `components/games/[slug]/index.tsx` renderiza el canvas y actualiza el HUD sin errores
- [ ] `/juego/[slug]/jugar` carga sin errores de SSR ni de consola
- [ ] Al terminar una partida, el score aparece en Supabase: `SELECT * FROM scores WHERE game_slug = '[slug]'`
- [ ] El modal pre-llena el nombre desde `localStorage.getItem('av_player_name')`
- [ ] Al guardar, el nombre se persiste en `av_player_name` y el score en `av_scores_[slug]`
- [ ] `/salon` muestra tab `[NOMBRE]` y filtra scores del juego
- [ ] `/juego/[slug]` muestra leaderboard lateral con datos de Supabase (o estado vacío si no hay scores)
- [ ] Los juegos ya existentes (asteroides, etc.) siguen funcionando sin cambios
- [ ] `npm run build` completa sin errores TypeScript
- [ ] `npm run lint` pasa sin errores

#### Decisiones

Captura al menos:

- Por qué un spec combinado (juego + leaderboard) en lugar de dos specs separados
- Por qué las páginas `/salon` y `/juego/[id]/page.tsx` no requieren cambios (diseño genérico del SPEC 06)
- El patrón callbacks/refs heredado de asteroides y si hay variaciones para este juego
- Cualquier decisión tomada durante las preguntas de la Fase 2

#### Riesgos

Tabla solo si hay riesgos no obvios. Riesgos estándar para cualquier integración de canvas:

| Riesgo                                                 | Mitigación                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| SSR del canvas (window/document undefined en servidor) | Dynamic import con `{ ssr: false }` en la página de juego                         |
| Fallo de `insertScore` en Supabase                     | Error silencioso (`console.error`); el score se guarda igualmente en localStorage |

Añade riesgos específicos del juego si los detectas en la Fase 2.

### Fase 4 — Guardar el spec

1. Determina el siguiente número secuencial desde el listado de `specs/` del contexto de sesión. Toma el número más alto y suma uno, con cero a la izquierda hasta dos dígitos.
2. Verifica que `specs/05-asteroides-juego-canvas.md` y `specs/06-leaderboard-supabase.md` existen (dependencias requeridas). Si falta alguna, indícalo en lugar de escribir una referencia colgante.
3. Escribe el archivo en `specs/NN-[slug]-juego.md`. **No pidas permiso ni confirmes el nombre de archivo** — anúncialo en la confirmación final. Solo pregunta si el archivo ya existe.
4. Estado: `Borrador`. **Nunca `Aprobado`** — el usuario lo cambia tras releerlo.
5. Confirma al usuario:
   - Ruta del archivo creado.
   - Recordatorio: el spec está en estado `Borrador`; cámbialo a `Aprobado` tras releerlo.
   - **Para aquí.** No propongas implementar, no escribas código, no tomes ninguna acción más.

## Reglas duras

- **Nunca escribas código durante este comando.** Solo el archivo `.md` del spec al final.
- **Nunca propongas implementar el spec tras guardarlo.** El usuario ejecuta `/spec-impl` cuando esté listo.
- **Nunca asumas decisiones que el usuario no confirmó.** Si falta información, pregunta — en la Fase 2.
- **La implementación canónica de referencia es `components/games/asteroides/`.** El spec la señala como patrón; no copia su código.
- **Fecha siempre desde el bash auto-run del contexto de sesión.** Nunca la inventes.
- **Si el juego es demasiado diferente del patrón canvas** (ej: requiere WebGL, workers, assets pesados), detecta el riesgo en la Fase 2 y refléjalo en el spec; no simplifiques ni omitas.

## Tono al preguntar

Directo y específico. No te disculpes por preguntar. Usa preguntas concretas con opciones cuando hay decisiones que tomar; indica cuál recomiendas y por qué. Numera las preguntas para que sean fáciles de responder.

## Argumento

`$ARGUMENTS` puede ser:

- El **nombre de una carpeta de referencia** (e.g. `03-tetris`) — úsala como punto de partida para la Fase 1 e infiere todo lo que puedas del `README.md` y `CLAUDE.md` de esa carpeta antes de preguntar.
- Una **descripción breve** del juego — úsala como contexto inicial para las preguntas de la Fase 2.
- Vacío — pide al usuario una descripción breve de qué juego quiere integrar.
