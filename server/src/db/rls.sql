-- Row-level security policies.
--
-- Run after creating the tables. These are the linchpin of multi-tenant isolation.
-- The session variable `app.tenant_id` is set per-request by the tenant middleware;
-- if it's not set, queries against these tables return zero rows (safe-by-default).

-- Enable RLS on all tenant-scoped tables.
ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets    ENABLE ROW LEVEL SECURITY;

-- The application connects as a non-superuser. Superusers bypass RLS, so
-- we must NOT use the postgres role for app connections in production.

-- Helper: read the current tenant from the session, defaulting to NULL
-- (which makes the policy comparison fail, returning zero rows).
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- USERS
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- DASHBOARDS
CREATE POLICY tenant_isolation_dashboards ON dashboards
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- WIDGETS
CREATE POLICY tenant_isolation_widgets ON widgets
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Sanity check: try to query users without setting app.tenant_id should return 0.
-- (Run this manually; can't include here without polluting migrations.)
