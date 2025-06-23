-- RBAC schema fixes for Oso Cloud and Drizzle

-- 1. Make org names globally unique
ALTER TABLE organizations ADD CONSTRAINT organizations_name_unique UNIQUE (name);

-- 2. Make project names unique within an org
ALTER TABLE projects ADD CONSTRAINT projects_org_id_name_unique UNIQUE (org_id, name);

-- 3. Allow multiple roles per user per project
ALTER TABLE users_to_projects DROP CONSTRAINT users_to_projects_user_id_project_id_pk;
ALTER TABLE users_to_projects ADD PRIMARY KEY (user_id, project_id, role); 