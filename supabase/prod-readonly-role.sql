-- =====================================================================
-- Acceso SOLO LECTURA a producción vía pooler (Transaction, puerto 6543)
-- Ejecutar en PROD (SQL Editor de Supabase) como `postgres`.
-- NO commitear con el password real: reemplazar <PASSWORD_FUERTE> al ejecutar.
-- =====================================================================

-- 1) Rol de grupo (NOLOGIN): solo permisos SELECT sobre `public`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'readonly_prod') THEN
    CREATE ROLE readonly_prod NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO readonly_prod;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_prod;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO readonly_prod;

-- Tablas futuras creadas por postgres (migraciones) también legibles
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO readonly_prod;

-- 2) Usuario de login dedicado (credencial propia, NO el password de la DB)
--    BYPASSRLS va en el rol de login: el atributo NO se hereda por membresía.
--    Solo ve lo que se le otorgue con GRANT (public); auth/storage quedan fuera.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'claude_ro') THEN
    CREATE ROLE claude_ro LOGIN BYPASSRLS PASSWORD '<PASSWORD_FUERTE>';
  END IF;
END $$;

GRANT readonly_prod TO claude_ro;
ALTER ROLE claude_ro INHERIT;

-- 3) Endurecimiento
ALTER ROLE claude_ro CONNECTION LIMIT 5;
ALTER ROLE claude_ro SET default_transaction_read_only = on;
ALTER ROLE claude_ro SET statement_timeout = '15s';
ALTER ROLE claude_ro SET idle_in_transaction_session_timeout = '10s';

-- Sin escritura/DDL, por si algo se otorgó antes
REVOKE CREATE ON SCHEMA public FROM claude_ro, readonly_prod;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM claude_ro, readonly_prod;

-- 4) Verificación (opcional)
-- SELECT rolname, rolbypassrls, rolcanlogin, rolconnlimit FROM pg_roles
--  WHERE rolname IN ('claude_ro','readonly_prod');
-- SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--  WHERE grantee = 'readonly_prod';

-- =====================================================================
-- Conexión (Transaction pooler, 6543)
-- Usuario = <rol>.<project_ref>  (el pooler exige el sufijo del proyecto)
--
-- postgresql://claude_ro.<PROJECT_REF>:<PASSWORD_FUERTE>@aws-0-<REGION>.pooler.supabase.com:6543/postgres
--
-- Host/región exactos: Dashboard → Connect → Transaction pooler.
-- Transaction mode: sin prepared statements (psycopg: prepare_threshold=None;
-- node-postgres ok; Prisma: ?pgbouncer=true).
--
-- Rollback:
--   REASSIGN OWNED BY claude_ro TO postgres; DROP OWNED BY claude_ro;
--   DROP ROLE claude_ro;
--   DROP OWNED BY readonly_prod; DROP ROLE readonly_prod;
-- =====================================================================
