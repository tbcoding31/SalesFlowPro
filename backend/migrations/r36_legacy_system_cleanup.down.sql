-- Migration Rollback: R36 Legacy SYSTEM Tenant Cleanup
-- Description: Restores SYSTEM tenant, TU-000 membership, and legacy role associations.

START TRANSACTION;

-- 1. Restore SYSTEM tenant
INSERT IGNORE INTO tenants (id, code, name, status, createdAt)
VALUES ('SYSTEM', 'SYS-001', 'System Administrator', 'ACTIVE', NOW());

-- 2. Restore TU-000 tenant membership
INSERT IGNORE INTO tenant_users (id, tenantId, userId, isPrimary, status, joinedAt)
VALUES ('TU-000', 'SYSTEM', 'USR-000', 1, 'ACTIVE', NOW());

-- 3. Restore TU-000 role assignment
INSERT IGNORE INTO tenant_user_roles (id, tenantUserId, roleId)
VALUES ('TUR-000', 'TU-000', 'SUPER_ADMIN');

-- 4. Revert roles tenantId back to 'SYSTEM' for legacy support if needed
UPDATE roles
SET tenantId = 'SYSTEM'
WHERE id = 'SUPER_ADMIN';

UPDATE roles
SET tenantId = 'SYSTEM'
WHERE id = 'TENANT_ADMIN' AND tenantId IS NULL;

COMMIT;
