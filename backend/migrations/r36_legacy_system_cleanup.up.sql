-- Migration: R36 Legacy SYSTEM Tenant Cleanup
-- Description: Converts SUPER_ADMIN and TENANT_ADMIN roles to NULL tenantId, ensures global_user_roles assignment, and removes legacy SYSTEM tenant and TU-000 membership.

START TRANSACTION;

-- 1. Ensure global_user_roles table exists
CREATE TABLE IF NOT EXISTS global_user_roles (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(50) NOT NULL,
  roleId VARCHAR(50) NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_role (userId, roleId)
);

-- 2. Ensure SUPER_ADMIN role exists and has tenantId = NULL, scope = 'SYSTEM'
UPDATE roles
SET tenantId = NULL, scope = 'SYSTEM'
WHERE id = 'SUPER_ADMIN';

-- 3. Ensure TENANT_ADMIN system template role has tenantId = NULL, scope = 'TENANT'
UPDATE roles
SET tenantId = NULL, scope = 'TENANT'
WHERE id = 'TENANT_ADMIN' AND (tenantId = 'SYSTEM' OR tenantId IS NULL);

-- 4. Ensure explicit global_user_roles assignment for USR-000 -> SUPER_ADMIN
INSERT IGNORE INTO global_user_roles (id, userId, roleId)
VALUES ('GUR-000', 'USR-000', 'SUPER_ADMIN');

-- 5. Ensure SUPER_ADMIN has ALL permission
INSERT IGNORE INTO role_permissions (roleId, permission)
VALUES ('SUPER_ADMIN', 'ALL');

-- 6. Remove legacy tenant_user_roles for TU-000
DELETE FROM tenant_user_roles
WHERE tenantUserId = 'TU-000';

-- 7. Remove legacy tenant_users membership for TU-000
DELETE FROM tenant_users
WHERE id = 'TU-000' OR tenantId = 'SYSTEM';

-- 8. Remove legacy pseudo-tenant SYSTEM
DELETE FROM tenants
WHERE id = 'SYSTEM';

COMMIT;
