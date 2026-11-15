---
name: evaluated-candidates
description: Candidatos de juego ya evaluados por el game-planner y no sugeridos (con motivo), y entradas mock de GAMES que son duplicados
metadata:
  type: project
---

Candidatos evaluados y dejados fuera del TODO (decisión propia, no descarte del usuario; reevaluar solo si cambia el reparto de categorías). Todos evaluados 2026-11-14. Puntuación D/F/R = total cuando se calculó.

## ARCADE

- `gloton` (mock) — 2/3/5 = 10. Laberinto + IA de 4 perseguidores, ~600 líneas: el más costoso de los mock.
- Esquivar tráfico cenital — solapa con `ranaria`.
- Saltador vertical de plataformas — total 10.

## SHOOTER

- Torreta central 360° — solapa con `cupula` y `asteroides`.
- Cañón inferior vs enemigo segmentado — demasiado cerca de `invasores`.
- Shooter de túnel pseudo-3D — F bajo.

## PUZZLE

- Buscaminas-like — puntuación basada en tiempo, mal encaje con leaderboard de puntos ascendentes.
- Empujar cajas — puntuación por movimientos/tiempo y niveles hechos a mano.
- Parejas de memoria — reserva; solapa con `secuencia`.
- Columnas de gemas / bloques en parejas / piezas en grilla 10×10 — demasiado cerca de `tetris`.
- Apagar luces, puzzle deslizante 15 — solo puntúan por tiempo/movimientos.
- Unir puntos — requiere niveles diseñados.
- Palabras — requiere diccionario.

## VERSUS

- `sumo-neon` — 5/4/3 = 12. RESERVA: empujar a la CPU fuera de un ring que se encoge. Primer candidato a subir si hace falta otro VERSUS.
- Hockey de aire — parecido a `duelo-pixel`.
- Vóley 1v1 — F3.
- Cuatro en línea — en realidad nicho PUZZLE y mal encaje con leaderboard.
- Duelo de reflejos — superficial.
- Biplanos — solapa con SHOOTER.

## Correcciones a evaluaciones anteriores

- Endless runner: NO exige categoría nueva, encaja en ARCADE. Sugerido como `corredor`.
- `ranaria`: pasó de evaluado-no-listado a sugerido (está en el TODO).
- Las 4 `CATS` existentes (ARCADE, PUZZLE, SHOOTER, VERSUS) bastaron para los 20 candidatos de la consolidación; no proponer categoría nueva sin un motivo fuerte.

## Mocks de `GAMES` que duplican juegos implementados — no sugerir nunca

- `bloque-buster` = `arkanoid`
- `caida` = `tetris`
- `serpentina` = `snake`
- `rocas` = `asteroides`

**Why:** evitar reevaluar lo mismo en cada ejecución y no proponer duplicados de mecánica.

**How to apply:** comprobar `references/implemented-games.md` antes de fiarse de esta lista; las puntuaciones D cambian cuando se implementan juegos. Historial de lo sí sugerido en [[suggestion-log]].
