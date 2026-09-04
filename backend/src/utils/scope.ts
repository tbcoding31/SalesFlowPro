export const buildReportScopeWhere = (actorTenant: string, actorUserId: string, actorRole: string, actorDataScope: string, actorPermissions: string[], ownerCol: string = 'picId') => {
  let where = 'WHERE tenantId = ?';
  const params: any[] = [actorTenant];

  if (actorRole !== 'SUPER_ADMIN' && !actorPermissions.includes('ALL') && !actorPermissions.includes('MANAGE_TENANT')) {
    if (actorDataScope === 'OWN') {
      where += ` AND ${ownerCol} = ?`;
      params.push(actorUserId);
    } else if (actorDataScope === 'TEAM') {
      where += ` AND ${ownerCol} IN (
        SELECT tu.userId FROM tenant_users tu
        JOIN team_members tm ON tm.tenantUserId = tu.id
        WHERE tm.teamId IN (
          SELECT tm2.teamId FROM team_members tm2
          JOIN tenant_users tu2 ON tu2.id = tm2.tenantUserId
          WHERE tu2.userId = ? AND tu2.tenantId = ? AND tu2.status = 'ACTIVE'
        ) AND tu.tenantId = ? AND tu.status = 'ACTIVE'
      )`;
      params.push(actorUserId, actorTenant, actorTenant);
    } else if (actorDataScope === 'DEPARTMENT') {
      where += ` AND 1 = 0 /* DEPARTMENT_SCOPE_NOT_ACTIVE */`;
    }
  }

  return { where, params };
};

export const validateTargetTenant = async (req: any, res: any, pool: any, actorTenant: string | null): Promise<string | false> => {
  const requestedTenant = req.query.tenantId || req.body?.tenantId || req.params?.tenantId || null;
  const isPlatformUser = req.isPlatformUser || false;

  let targetTenant = actorTenant !== null ? actorTenant : (requestedTenant as string | null);
  
  // The Prompt requires:
  // SUPER_ADMIN/SYSTEM may use explicit tenant target only if:
  // - authenticated as explicit SYSTEM principal
  // - target tenant is supplied
  // - target tenant exists in MySQL.
  
  if (isPlatformUser && requestedTenant) {
     targetTenant = requestedTenant;
  } else if (!isPlatformUser && requestedTenant && requestedTenant !== actorTenant) {
     // Cross-tenant override denied
     res.status(403).json({ error: 'CROSS_TENANT_OVERRIDE_DENIED' });
     return false;
  }

  if (!targetTenant) {
    res.status(400).json({ error: 'TARGET_TENANT_REQUIRED' });
    return false;
  }
  
  if (isPlatformUser && requestedTenant) {
    const [tCheck]: any = await pool.query('SELECT id FROM tenants WHERE id = ?', [targetTenant]);
    if (tCheck.length === 0) {
      res.status(404).json({ error: 'TENANT_NOT_FOUND' });
      return false;
    }
  }
  
  return targetTenant as string;
};

export async function evaluateTenantAccess(pool: any, tenantId: string): Promise<{ allowed: boolean, reason: string, trialEndDate?: string }> {
  const [tenantRows]: any = await pool.query('SELECT status, type, trialEndDate FROM tenants WHERE id = ?', [tenantId]);
  
  if (tenantRows.length === 0) {
    return { allowed: false, reason: 'TENANT_NOT_FOUND' };
  }

  const tenant = tenantRows[0];

  if (tenant.status !== 'ACTIVE') {
    return { allowed: false, reason: 'TENANT_SUSPENDED' };
  }

  if (tenant.type && tenant.type.toUpperCase().includes('TRIAL') && tenant.trialEndDate) {
    const trialEnd = new Date(tenant.trialEndDate);
    const now = new Date();
    
    // Check if trial has expired based on server time
    if (now > trialEnd) {
      return { 
        allowed: false, 
        reason: 'TRIAL_EXPIRED',
        trialEndDate: tenant.trialEndDate
      };
    }
  }

  return { allowed: true, reason: 'ACTIVE' };
}

export async function revokeTenantSessions(pool: any, tenantId: string): Promise<void> {
  await pool.query(
    `DELETE FROM auth_sessions 
     WHERE userId IN (
       SELECT userId FROM tenant_users WHERE tenantId = ?
     )`,
    [tenantId]
  );
}
