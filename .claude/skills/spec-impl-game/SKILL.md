---
name: spec-impl-game
description: Implementa un spec aprobado de un juego nuevo (mismo flujo que /spec-impl) y, al terminar, lanza en secuencia los agentes skin-designer y mobile-porter sobre ese juego.
disable-model-invocation: true
argument-hint: "<NN-spec-name>"
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — spec-impl + skins + mobile

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

---

El argumento recibido es: `$ARGUMENTS`

## Parte A — Implementación (idéntica a /spec-impl)

1. Lee `.agents/skills/spec-impl/SKILL.md` (fuente de verdad; no la dupliques ni la resumas de memoria).
2. Ejecuta sus Fases 1–4 exactamente como están escritas, usando `$ARGUMENTS` como spec y el contexto de sesión de arriba: identificar spec, validar estado `Aprobado`, rama `spec-NN-slug`, implementación paso a paso con pausas y sin commits automáticos.
3. Si cualquier fase se detiene (spec no aprobado, árbol sucio sin confirmar, ambigüedad, el usuario no completa los pasos), **termina ahí**: no ejecutes la Parte B.

## Parte B — Agentes post-implementación

Solo cuando todos los pasos del plan estén implementados y confirmados por el usuario.

### B1 — Resolver el slug del juego

Obtén el slug del juego nuevo (carpeta `components/games/<slug>/`) a partir del spec y de `git diff --name-only` / `ls components/games/`.

- Si el spec no crea un juego canvas, o hay más de un candidato, o no estás seguro: pregunta al usuario con `AskUserQuestion`. No lances agentes con un slug dudoso.

### B2 — `skin-designer`

Lanza el agente `skin-designer` (Agent tool, `subagent_type: skin-designer`) con el slug como único dato en el prompt. **Espera a que termine** y lee su reporte.

### B3 — `mobile-porter`

Solo después de que `skin-designer` haya terminado, lanza `mobile-porter` (`subagent_type: mobile-porter`) con el mismo slug. **Nunca en paralelo**: cada llamada a `Agent` va en su propio mensaje.

Si `skin-designer` falló o reportó un bloqueo, informa y pregunta al usuario antes de lanzar `mobile-porter`.

### B4 — Cierre

Muestra los reportes de ambos agentes de forma concisa y recuerda lo pendiente: verificar criterios de aceptación del spec, `npm run build` + `npm run lint`, marcar `Status: Implemented` y commitear (decisión del usuario; no commitees tú).
