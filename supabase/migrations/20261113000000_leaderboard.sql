-- Tabla games: catálogo de juegos reales con soporte de Supabase
CREATE TABLE games (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug   text NOT NULL UNIQUE,
  name   text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

-- Tabla scores: puntuaciones de jugadores por juego
CREATE TABLE scores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug   text        NOT NULL REFERENCES games(slug),
  player_name text        NOT NULL,
  score       integer     NOT NULL CHECK (score >= 0),
  user_id     uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE games  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read games"    ON games  FOR SELECT USING (true);
CREATE POLICY "public read scores"   ON scores FOR SELECT USING (true);
CREATE POLICY "public insert scores" ON scores FOR INSERT WITH CHECK (true);

-- Seed inicial
INSERT INTO games (slug, name, active) VALUES ('asteroides', 'ASTEROIDES', true);
