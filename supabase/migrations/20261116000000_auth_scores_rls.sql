-- SPEC 14: solo usuarios autenticados insertan scores propios.
DROP POLICY "public insert scores" ON scores;

CREATE POLICY "authenticated insert own scores" ON scores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX scores_user_id_idx ON scores (user_id);
