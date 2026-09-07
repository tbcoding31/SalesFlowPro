export const resolveUserAccessContext = async (pool: any, userId: string) => {
  const [globalUserRows]: any = await pool.query('SELECT id, email, name, status FROM users WHERE id = ?', [userId]);
  
  if (globalUserRows.length === 0) {
    return {
      exists: false,
      userGlobalStatus: 'MISSING',
      tenantId: null,
      tenantUserId: null,
      tenantUserStatus: 'MISSING',
      roleId: null,
      roleCode: null,
      roleName: null,
      isPlatformUser: false,
      permissions: [],
      dataScope: 'OWN',
      isOrphan: true
    };
  }

  const userGlobalStatus = globalUserRows[0].status;

  const [membershipRows]: any = await pool.query(`
    SELECT tu.id as tenantUserId, tu.tenantId, tu.status as tenantUserStatus, tur.roleId, r.name as roleName, r.code as roleCode, r.scope
    FROM tenant_users tu
    LEFT JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
    LEFT JOIN roles r ON r.id = tur.roleId
    WHERE tu.userId = ? AND tu.isPrimary = true
  `, [userId]);

  let tenantId: string | null = null;
  let tenantUserId: string | null = null;
  let tenantUserStatus: string = 'MISSING';
  let roleId: string | null = null;
  let roleCode: string | null = null;
  let roleName: string | null = null;
  let isPlatformUser = false;
  let isOrphan = true;

  if (membershipRows.length > 0 && membershipRows[0].tenantId) {
    tenantId = membershipRows[0].tenantId;
    tenantUserId = membershipRows[0].tenantUserId;
    tenantUserStatus = membershipRows[0].tenantUserStatus;
    roleId = membershipRows[0].roleId;
    roleName = membershipRows[0].roleName;
    roleCode = membershipRows[0].roleCode;
    if (tenantUserStatus === 'ACTIVE' && roleId !== null && roleName !== null) {
      isOrphan = false; // Has active membership AND valid role assignment
    }
  } else {
    // Check for explicit platform/system role
    const [globalUserRoleRows]: any = await pool.query(`
      SELECT gur.roleId, r.name as roleName, r.code as roleCode, r.scope
      FROM global_user_roles gur
      JOIN roles r ON r.id = gur.roleId
      WHERE gur.userId = ? AND r.scope = 'SYSTEM'
      LIMIT 1
    `, [userId]);
    
    if (globalUserRoleRows.length > 0) {
      roleId = globalUserRoleRows[0].roleId;
      roleName = globalUserRoleRows[0].roleName;
      roleCode = globalUserRoleRows[0].roleCode;
      isPlatformUser = true;
      isOrphan = false; // Is explicit SYSTEM user
    }
  }

  // Fallback normalize roleCode if null
  if (!roleCode && roleId) {
    if (roleId === 'SUPER_ADMIN' || roleId.endsWith('SUPER_ADMIN')) {
      roleCode = 'SUPER_ADMIN';
    } else if (roleId.endsWith('TENANT_ADMIN') || roleId.startsWith('ROL-ADM')) {
      roleCode = 'TENANT_ADMIN';
    } else if (roleId.endsWith('SALES_MANAGER')) {
      roleCode = 'SALES_MANAGER';
    } else if (roleId.endsWith('SUPERVISOR') || roleId.startsWith('ROL-SUP')) {
      roleCode = 'SUPERVISOR';
    } else if (roleId.endsWith('SALES_REP') || roleId.startsWith('ROL-REP')) {
      roleCode = 'SALES_REP';
    } else {
      roleCode = roleId;
    }
  }

  let permissions: string[] = [];
  let dataScope = 'OWN';
  if (roleId) {
    const [permRows]: any = await pool.query('SELECT permission FROM role_permissions WHERE roleId = ?', [roleId]);
    permissions = permRows.map((p: any) => p.permission);
    
    const [scopeRows]: any = await pool.query('SELECT scope as dataScope FROM role_data_scopes WHERE roleId = ? LIMIT 1', [roleId]);
    if (scopeRows.length > 0) {
      dataScope = scopeRows[0].dataScope;
    }
  }

  return {
    exists: true,
    userGlobalStatus,
    tenantId,
    tenantUserId,
    tenantUserStatus,
    roleId,
    roleCode: roleCode || roleId,
    roleName,
    isPlatformUser,
    permissions,
    dataScope,
    isOrphan
  };
};
