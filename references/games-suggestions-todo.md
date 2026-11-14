# Sugerencias de juegos — TODO

Mantenido por el agente `game-planner`. Criterios (1–5): diversidad de categoría (D), facilidad en canvas 2D (F), reconocimiento clásico (R).

Formato: `- [ ] slug — TÍTULO · CATEGORÍA · D_ F_ R_ = total — motivo. (sugerido AAAA-MM-DD)`

## Pendientes

- [ ] `duelo-pixel` — DUELO PIXEL · VERSUS · D5 F4 R5 = 14 — estrena la categoría VERSUS (vacía), ya tiene ficha mock; 1 jugador vs CPU con puntos por rally y por gol. _(sugerido 2026-11-14)_
- [ ] `obus` — OBÚS · VERSUS · D5 F4 R5 = 14 — duelo de artillería por turnos (ángulo, potencia, viento) vs cañón CPU; puntos por daño × impacto directo + bonus por duelo ganado; ~550 líneas sin assets; usar heightmap fijo o cráteres simples; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `estela` — ESTELA · VERSUS · D4 F5 R5 = 14 — duelo de motos de luz en grilla, pierde quien choca con un muro; +1 por celda + 500×nivel por ronda, 3 vidas; ~350 líneas sin assets; grilla parecida a `snake`, IA con flood-fill; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `once-metros` — ONCE METROS · VERSUS · D5 F4 R4 = 13 — tanda de penaltis alterna tirar/parar; +100 gol, +150 parada, multiplicador por racha, 3 fallos = fin; ~450 líneas con primitivas; afinar CPU para premiar habilidad y no azar; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `rebufo` — REBUFO · VERSUS · D5 F4 R4 = 13 — carrera cenital de 4 carriles vs pilotos CPU con rebufo; distancia + 200 por adelantamiento, 3 choques = fin; ~500 líneas sin assets; si los rivales no compiten queda en esquiva-tráfico ARCADE; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `blindados` — BLINDADOS · VERSUS · D4 F4 R5 = 13 — duelo de tanques en tiempo real en arena con muros, proyectiles con un rebote; +100×oleada por tanque, 3 vidas; ~650 líneas sin assets; IA debe navegar muros; cercano a SHOOTER (`enjambre`); slug nuevo. _(sugerido 2026-11-14)_
- [ ] `invasores` — INVASORES · SHOOTER · D3 F5 R5 = 13 — ficha mock existente; formación en grilla, colisiones AABB y puntuación por enemigo/oleada, encaje directo con leaderboard. _(sugerido 2026-11-14)_
- [ ] `cupula` — CÚPULA · SHOOTER · D3 F5 R5 = 13 — defensa de 6 ciudades: clic lanza interceptor que detona en ese punto; multiplicador por cadena y bonus de oleada por ciudades y munición; ~400-500 líneas sin assets; depende del ratón (táctil/teclado necesita cursor alternativo); slug nuevo. _(sugerido 2026-11-14)_
- [ ] `secuencia` — SECUENCIA · PUZZLE · D3 F5 R5 = 13 — memoria: 4 paneles se iluminan en secuencia creciente a repetir; paso × ronda + bonus por ronda y rapidez, un fallo = fin; ~220 líneas sin assets; puntuaciones agrupadas, diseñar bonus de rapidez; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `fusion` — FUSIÓN · PUZZLE · D3 F5 R4 = 12 — deslizar y fusionar fichas numéricas en grilla 4×4; sin bucle en tiempo real, puntuación acumulada natural; requiere entrada nueva en `GAMES`. _(sugerido 2026-11-14)_
- [ ] `barraca` — BARRACA · SHOOTER · D3 F5 R4 = 12 — galería de tiro: dianas por 3-4 carriles, cargador limitado y señuelos; multiplicador por racha, rondas de 60 s con umbral mínimo; ~350-450 líneas sin assets; sin avatar ni peligro puede sentirse plano; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `colapso` — COLAPSO · PUZZLE · D3 F5 R4 = 12 — clic en grupos de 2+ bloques contiguos del mismo color, columnas caen y compactan; n² por grupo + bonus tablero limpio; ~260 líneas sin assets; poco reconocible y poca tensión sin tiempo real (opción: fila que sube); slug nuevo. _(sugerido 2026-11-14)_
- [ ] `rafaga` — RÁFAGA · SHOOTER · D3 F4 R5 = 12 — shooter de scroll vertical con oleadas guionizadas, power-ups y jefe cada N oleadas; medallas suben multiplicador y se pierden al recibir daño, 3 vidas; ~650-800 líneas, atlas recomendable; coste en contenido, recortar alcance; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `gemas` — GEMAS · PUZZLE · D3 F4 R5 = 12 — grilla 8×8, intercambiar adyacentes para alinear 3+ con gravedad y cascadas; ficha × multiplicador de cascada, 90 s con tiempo extra por combos; ~450 líneas sin assets; animaciones con máquina de estados y detección de tablero sin movimientos; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `burbujas` — BURBUJAS · PUZZLE · D3 F4 R5 = 12 — lanzar burbujas a racimo hexagonal, 3+ del mismo color estallan y las sueltas caen; doble por las que caen, techo baja cada N tiros; ~450 líneas sin assets; grilla hexagonal, rebotes y dos flood-fill; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `corredor` — CORREDOR · ARCADE · D2 F5 R5 = 12 — runner lateral infinito: saltar/agacharse con scroll que acelera; distancia + bonus por núcleos, muerte al primer choque; ~300 líneas sin assets; variar patrones; solapa algo con `aleteo`; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `mazazo` — MAZAZO · ARCADE · D2 F5 R5 = 12 — reflejos en grilla 3×3: golpear objetivos que asoman y evitar señuelos; multiplicador de racha, 3 fallos o 60 s; ~250 líneas sin assets; input ratón/táctil, teclado requiere mapear 1-9; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `aleteo` — ALETEO · ARCADE · D2 F5 R5 = 12 — un botón da impulso contra la gravedad para pasar huecos entre columnas; +10 por columna; ~220 líneas sin assets; puntuaciones agrupadas y empates; exige identidad visual propia; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `enjambre` — ENJAMBRE · SHOOTER · D3 F4 R4 = 11 — twin-stick en arena: WASD + puntería con ratón 360°, enemigos con 3-4 comportamientos; gemas suben multiplicador permanente, 3 vidas; ~550-700 líneas sin assets; el más cercano a `asteroides`, no jugable en móvil; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `tuberias` — TUBERÍAS · PUZZLE · D3 F4 R4 = 11 — rotar tramos de tubería para conducir un fluido tras cuenta atrás; puntos por tramo + bonus por cruces y longitud mínima; ~420 líneas sin assets; generar tableros siempre resolubles y animar fluido; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `ranaria` — RANARIA · ARCADE · D2 F4 R5 = 11 — ficha mock existente (`cover-rana`); cruzar carriles de tráfico y río de troncos hasta metas con temporizador; fila avanzada + meta + bonus de tiempo, 3 vidas; ~450 líneas, atlas opcional; el más caro del nicho ARCADE. _(sugerido 2026-11-14)_
- [ ] `torre` — TORRE · ARCADE · D2 F5 R4 = 11 — apilar bloques que oscilan, lo que sobresale se recorta; puntos por piso + bonus por encaje perfecto consecutivo; ~200 líneas sin assets; el menos reconocible, sesiones muy cortas; slug nuevo. _(sugerido 2026-11-14)_
- [ ] `patrulla` — PATRULLA · SHOOTER · D3 F3 R4 = 10 — scroll horizontal sobre terreno procedural con disparo frontal, bombas y combustible; distancia + puntos por objetivo + bonus por sector; ~700-850 líneas sin assets; el más caro; no implementar seguido de `rafaga`; slug nuevo. _(sugerido 2026-11-14)_

## Implementados

## Descartados
