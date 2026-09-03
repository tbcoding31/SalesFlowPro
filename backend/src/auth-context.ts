export const resolveUserAccessContext = async (pool: any, userId: string) => {
  const [globalUserRows]: any = await pool.query('SELECT id, email, name, status FROM users WHERE id = ?', [userId]);
  const userGlobalStatus = globalUserRows.length > 0 ? (globalUserRows[0].status || 'ACTIVE') : 'ACTIVE';

  const [membershipRows]: any = await pool.query(`
    SELECT tu.id as tenantUserId, tu.tenantId, tu.status as tenantUserStatus, tur.roleId, r.name as roleName, r.scope
    FROM tenant_users tu
    LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
    LEFT JOIN roles r ON r.id = tur.roleId
    WHERE tu.userId = ? AND tu.isPrimary = true
  `, [userId]);

  let tenantId: string | null = null;
  let tenantUserId: string | null = null;
  let tenantUserStatus: string = 'ACTIVE';
  let roleId: string | null = null;
  let roleName: string | null = null;
  let isPlatformUser = false;

  if (membershipRows.length > 0 && membershipRows[0].tenantId) {
    tenantId = membershipRows[0].tenantId;
    tenantUserId = membershipRows[0].tenantUserId;
    tenantUserStatus = membershipRows[0].tenantUserStatus || 'ACTIVE';
    roleId = membershipRows[0].roleId;
    roleName = membershipRows[0].roleName;
  } else {
    try {
      const [globalUserRoleRows]: any = await pool.query(`
        SELECT gur.roleId, r.name as roleName, r.scope
        FROM global_user_roles gur
        JOIN roles r ON r.id = gur.roleId
        WHERE gur.userId = ?
        LIMIT 1
      `, [userId]);
      if (globalUserRoleRows.length > 0) {
        roleId = globalUserRoleRows[0].roleId;
        roleName = globalUserRoleRows[0].roleName;
        isPlatformUser = globalUserRoleRows[0].scope === 'SYSTEM';
      }
    } catch (e: any) { }
  }

  let permissions: string[] = [];
  let dataScope = 'OWN';
  if (roleId) {
    try {
      const [permRows]: any = await pool.query('SELECT permission FROM role_permissions WHERE roleId = ?', [roleId]);
      permissions = permRows.map((p: any) => p.permission);
      const [scopeRows]: any = await pool.query('SELECT dataScope FROM role_data_scopes WHERE roleId = ? LIMIT 1', [roleId]);
      if (scopeRows.length > 0) dataScope = scopeRows[0].dataScope;
    } catch (e: any) { }
  }

  return {
    userGlobalStatus,
    tenantId,
    tenantUserId,
    tenantUserStatus,
    roleId,
    roleName,
    isPlatformUser,
    permissions,
    dataScope
  };
};
