-- Extend games table with catalog fields
ALTER TABLE games
  ADD COLUMN short  text NOT NULL DEFAULT '',
  ADD COLUMN long   text NOT NULL DEFAULT '',
  ADD COLUMN cat    text NOT NULL DEFAULT 'ARCADE',
  ADD COLUMN cover  text NOT NULL DEFAULT '',
  ADD COLUMN color  text NOT NULL DEFAULT 'cyan',
  ADD COLUMN best   integer NOT NULL DEFAULT 0,
  ADD COLUMN plays  text NOT NULL DEFAULT '0';

-- Populate asteroides
UPDATE games SET
  short = 'Pulveriza rocas espaciales en gravedad cero.',
  long  = 'Tu nave triangular navega el vacío absoluto. Rota, dispara y esquiva para fragmentar asteroides en pedazos cada vez más pequeños. Recoge el power-up triple disparo y sobrevive hasta el último fragmento.',
  cat   = 'SHOOTER',
  cover = 'cover-rocas',
  color = 'yellow',
  best  = 41200,
  plays = '15.6K'
WHERE slug = 'asteroides';

-- Populate tetris
UPDATE games SET
  short = 'Encaja los 7 tetrominos clásicos sin que el pozo se llene.',
  long  = 'Siete piezas caen desde las alturas: encástralas sin huecos para limpiar líneas y sumar puntos. Pieza fantasma y hard drop te dan control total; la velocidad aumenta cada 10 líneas. ¿Cuánto aguantas cuando el techo no perdona?',
  cat   = 'PUZZLE',
  cover = 'cover-tetro',
  color = 'cyan',
  best  = 0,
  plays = '0'
WHERE slug = 'tetris';
