---
name: suggestion-log
description: Historial de sugerencias de juegos del game-planner — slugs, puntuaciones D/F/R, razonamiento y estado
metadata:
  type: project
---

El TODO (`references/games-suggestions-todo.md`) manda sobre este registro; si difieren, corregir aquí.

Estado a 2026-11-14: 23 pendientes, 0 implementados, 0 descartados. Sin respuesta del usuario a ninguna sugerencia todavía.

## 2026-11-14 (primera ejecución, TODO y memoria vacíos)

Estado del catálogo ese día: implementados `asteroides` (SHOOTER), `tetris` (PUZZLE), `arkanoid` (ARCADE), `snake` (ARCADE). VERSUS = 0 implementados.

| slug          | cat     | D   | F   | R   | total | nota                                                                      |
| ------------- | ------- | --- | --- | --- | ----- | ------------------------------------------------------------------------- |
| `duelo-pixel` | VERSUS  | 5   | 4   | 5   | 14    | RECOMENDADO. Mock existente. Solo 1P vs CPU; 2P local fuera de alcance.   |
| `invasores`   | SHOOTER | 3   | 5   | 5   | 13    | Mock existente.                                                           |
| `fusion`      | PUZZLE  | 3   | 5   | 4   | 12    | Slug nuevo (fusión de fichas numéricas 4×4), requiere entrada en `GAMES`. |

**Why:** VERSUS es la única categoría de `CATS` sin juego real; duelo-pixel la cubre con el menor esfuerzo. F4 y no F5 porque la puntuación de leaderboard hay que diseñarla (un marcador tipo 11-7 no sirve): propuesta = puntos por golpe de rally con multiplicador + bonus por gol al CPU, 3 vidas, CPU acelera por nivel.

## 2026-11-14 (consolidación: 4 instancias en paralelo, una por nicho, 20 sugerencias)

Mismo estado de catálogo. Todas caben en las `CATS` existentes. Todas son slug nuevo (entrada en `GAMES` + clase `cover-*`) salvo `ranaria` (mock, `cover-rana`). No se marcó recomendada nueva en esta tanda. Columna "líneas" = estimación de `game.ts`.

### VERSUS

| slug          | D   | F   | R   | total | líneas | mecánica / pega                                                                                               |
| ------------- | --- | --- | --- | ----- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `obus`        | 5   | 4   | 5   | 14    | ~550   | Artillería por turnos vs CPU. Terreno destructible encarece (heightmap fijo o cráteres simples); ritmo lento. |
| `estela`      | 4   | 5   | 5   | 14    | ~350   | Motos de luz en grilla. Movimiento parecido a `snake`; IA con flood-fill.                                     |
| `once-metros` | 5   | 4   | 4   | 13    | ~450   | Penaltis tirar/parar. CPU en parte azar, afinar.                                                              |
| `rebufo`      | 5   | 4   | 4   | 13    | ~500   | Carrera cenital 4 carriles vs CPU. Si los rivales no compiten queda en esquiva-tráfico ARCADE.                |
| `blindados`   | 4   | 4   | 5   | 13    | ~650   | Tanques en arena con muros y rebote. IA de navegación; cercano a SHOOTER (`enjambre`).                        |

### SHOOTER

| slug       | D   | F   | R   | total | líneas   | mecánica / pega                                                                          |
| ---------- | --- | --- | --- | ----- | -------- | ---------------------------------------------------------------------------------------- |
| `cupula`   | 3   | 5   | 5   | 13    | ~400-500 | Defensa de 6 ciudades con interceptores. Depende del ratón.                              |
| `barraca`  | 3   | 5   | 4   | 12    | ~350-450 | Galería de tiro con señuelos. Sin avatar ni peligro, puede sentirse plano.               |
| `rafaga`   | 3   | 4   | 5   | 12    | ~650-800 | Scroll vertical con oleadas y jefes. Atlas recomendable; coste en contenido.             |
| `enjambre` | 3   | 4   | 4   | 11    | ~550-700 | Twin-stick en arena. El más cercano a `asteroides`; no jugable en móvil.                 |
| `patrulla` | 3   | 3   | 4   | 10    | ~700-850 | Scroll horizontal, bombas, combustible. El más caro; no implementar seguido de `rafaga`. |

### PUZZLE

| slug        | D   | F   | R   | total | líneas | mecánica / pega                                                                     |
| ----------- | --- | --- | --- | ----- | ------ | ----------------------------------------------------------------------------------- |
| `secuencia` | 3   | 5   | 5   | 13    | ~220   | Memoria de 4 paneles. Partidas cortas, puntuaciones agrupadas; bonus de rapidez.    |
| `gemas`     | 3   | 4   | 5   | 12    | ~450   | Match-3 8×8 con cascadas. Máquina de estados de animación; tablero sin movimientos. |
| `burbujas`  | 3   | 4   | 5   | 12    | ~450   | Lanzar burbujas a racimo hexagonal. Grilla hex, rebotes, dos flood-fill.            |
| `colapso`   | 3   | 5   | 4   | 12    | ~260   | Clic en grupos del mismo color. Poco reconocible, poca tensión (opción: fila sube). |
| `tuberias`  | 3   | 4   | 4   | 11    | ~420   | Rotar tuberías antes del fluido. Generar tableros siempre resolubles.               |

### ARCADE (D=2 fijo: categoría más poblada)

| slug       | D   | F   | R   | total | líneas | mecánica / pega                                                                  |
| ---------- | --- | --- | --- | ----- | ------ | -------------------------------------------------------------------------------- |
| `corredor` | 2   | 5   | 5   | 12    | ~300   | Runner lateral infinito. Variar patrones; solapa algo con `aleteo`.              |
| `mazazo`   | 2   | 5   | 5   | 12    | ~250   | Reflejos en grilla 3×3. Ratón/táctil; teclado requiere mapear 1-9.               |
| `aleteo`   | 2   | 5   | 5   | 12    | ~220   | Un botón contra gravedad. Puntuaciones agrupadas; exige identidad visual propia. |
| `ranaria`  | 2   | 4   | 5   | 11    | ~450   | Mock existente. Carriles + río de troncos. El más caro del nicho.                |
| `torre`    | 2   | 5   | 4   | 11    | ~200   | Apilar bloques oscilantes. El menos reconocible, sesiones muy cortas.            |

**Why:** el usuario pidió poblar el TODO por nichos de una vez en lugar de 3 por ejecución; las puntuaciones vienen de las instancias paralelas y se registraron sin reevaluar.

**How to apply:** no volver a sugerir ninguno de los 23 mientras sigan en el TODO. Las D quedan desfasadas en cuanto se implemente un juego (sobre todo las D5/D4 de VERSUS cuando deje de estar vacía): recalcular antes de recomendar. Ver [[evaluated-candidates]] para los evaluados y no listados.
