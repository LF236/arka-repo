-- ARCADE VAULT · bootstrap prod (esquema final + catálogo games)
-- Ejecutar UNA vez en Prod → SQL Editor. Proyecto vacío.
BEGIN;

CREATE TABLE public.games (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug   text NOT NULL UNIQUE,
  name   text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  short  text NOT NULL DEFAULT '',
  long   text NOT NULL DEFAULT '',
  cat    text NOT NULL DEFAULT 'ARCADE',
  cover  text NOT NULL DEFAULT '',
  color  text NOT NULL DEFAULT 'cyan',
  best   integer NOT NULL DEFAULT 0,
  plays  text NOT NULL DEFAULT '0'
);

CREATE TABLE public.scores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug   text        NOT NULL REFERENCES public.games(slug),
  player_name text        NOT NULL,
  score       integer     NOT NULL CHECK (score >= 0),
  user_id     uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scores_user_id_idx ON public.scores (user_id);

ALTER TABLE public.games  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read games"  ON public.games  FOR SELECT USING (true);
CREATE POLICY "public read scores" ON public.scores FOR SELECT USING (true);
CREATE POLICY "authenticated insert own scores" ON public.scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Grants mínimos (más estricto que Dev: también quita TRUNCATE/REFERENCES/TRIGGER)
REVOKE ALL ON public.games  FROM anon, authenticated;
REVOKE ALL ON public.scores FROM anon, authenticated;
GRANT SELECT ON public.games  TO anon, authenticated;
GRANT SELECT ON public.scores TO anon, authenticated;
GRANT INSERT ON public.scores TO authenticated;

-- Catálogo (volcado de Dev)
INSERT INTO public.games (slug,name,short,long,cat,cover,color,best,plays,active) VALUES
('arkanoid','ARKANOID','','','ARCADE','','cyan',0,'0',true),
('asteroides','ASTEROIDES','Pulveriza rocas espaciales en gravedad cero.','Tu nave triangular navega el vacío absoluto. Rota, dispara y esquiva para fragmentar asteroides en pedazos cada vez más pequeños. Recoge el power-up triple disparo y sobrevive hasta el último fragmento.','SHOOTER','cover-rocas','yellow',41200,'15.6K',true),
('frogger','FROGGER','Cruza la carretera y el río sin convertirte en papilla.','Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.','ARCADE','cover-frogger','green',0,'0',true),
('snake','SNAKE','Come frutas, crece y no toques las paredes.','Una serpiente de píxeles recorre una cuadrícula de 32×32 celdas coleccionando frutas del atlas. Cada bocado la alarga y acelera su ritmo. Las paredes son letales y morder tu propia cola significa el fin. ¿Cuántas frutas aguantas antes de que la velocidad te supere?','ARCADE','cover-snake','magenta',0,'0',true),
('tetris','TETRIS','Encaja los 7 tetrominos clásicos sin que el pozo se llene.','Siete piezas caen desde las alturas: encástralas sin huecos para limpiar líneas y sumar puntos. Pieza fantasma y hard drop te dan control total; la velocidad aumenta cada 10 líneas. ¿Cuánto aguantas cuando el techo no perdona?','PUZZLE','cover-tetro','cyan',0,'0',true);

COMMIT;
