-- SPEC 15: defensa en profundidad sobre RLS.
-- games: inmutable desde cliente (cambios por migración/MCP, service_role no se ve afectado).
REVOKE INSERT, UPDATE, DELETE ON public.games FROM anon, authenticated;

-- scores: sin UPDATE/DELETE; INSERT solo para authenticated (policy auth.uid() = user_id).
REVOKE UPDATE, DELETE ON public.scores FROM anon, authenticated;
REVOKE INSERT ON public.scores FROM anon;
