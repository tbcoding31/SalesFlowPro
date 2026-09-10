import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { validateTargetTenant } from '../utils/scope';
import { VALID_INTERVENTION_SEVERITIES, VALID_INTERVENTION_CONDITION_TYPES } from '../controllers/interventions.controller';

export const interventionPoliciesRoutes = Router();
export const tenantAnalyticsSettingsRoutes = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/tenant/project-intervention-policies
// ─────────────────────────────────────────────────────────────
interventionPoliciesRoutes.get('/', async (req: Request, res: Response) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const hasViewPerm = actorRole === 'SUPER_ADMIN' ||
      actorPermissions.includes('ALL') ||
      actorPermissions.includes('MANAGE_TENANT') ||
      actorPermissions.includes('VIEW_REPORTS') ||
      actorPermissions.includes('MANAGE_USERS');

    if (!hasViewPerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to view intervention policies.' });
    }

    const [policies]: any = await pool.query(
      'SELECT * FROM project_intervention_policies WHERE tenantId = ? ORDER BY createdAt DESC',
      [targetTenant]
    );

    const policyIds = policies.map((p: any) => p.id);
    let conditions: any[] = [];
    if (policyIds.length > 0) {
      const [cRows]: any = await pool.query(
        'SELECT * FROM project_intervention_policy_conditions WHERE policyId IN (?)',
        [policyIds]
      );
      conditions = cRows;
    }

    const conditionsByPolicy: Record<string, string[]> = {};
    for (const c of conditions) {
      if (!conditionsByPolicy[c.policyId]) conditionsByPolicy[c.policyId] = [];
      conditionsByPolicy[c.policyId].push(c.conditionType);
    }

    const result = policies.map((p: any) => ({
      id: p.id,
      tenantId: p.tenantId,
      code: p.code,
      name: p.name,
      description: p.description,
      severity: p.severity,
      matchMode: p.matchMode,
      status: p.status,
      createdById: p.createdById,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      conditions: conditionsByPolicy[p.id] || []
    }));

    res.json({
      tenantId: targetTenant,
      policies: result,
      items: result
    });
  } catch (err: any) {
    console.error('Error in GET /api/tenant/project-intervention-policies:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/tenant/project-intervention-policies
// ─────────────────────────────────────────────────────────────
interventionPoliciesRoutes.post('/', async (req: Request, res: Response) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const hasManagePerm = actorRole === 'SUPER_ADMIN' ||
      actorPermissions.includes('ALL') ||
      actorPermissions.includes('MANAGE_TENANT');

    if (!hasManagePerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to create intervention policies.' });
    }

    const { code, name, description, severity, matchMode, status, conditions = [] } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Policy code is required.', code: 'MISSING_POLICY_CODE' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Policy name is required.', code: 'MISSING_POLICY_NAME' });
    }

    if (!severity || !VALID_INTERVENTION_SEVERITIES.includes(severity)) {
      return res.status(400).json({ error: `Explicit severity is required. Allowed: ${VALID_INTERVENTION_SEVERITIES.join(', ')}`, code: 'INVALID_SEVERITY' });
    }

    if (!matchMode || matchMode !== 'ALL') {
      return res.status(400).json({ error: 'Explicit matchMode is required. Currently supported: ALL', code: 'INVALID_MATCH_MODE' });
    }

    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed: ACTIVE, INACTIVE', code: 'INVALID_STATUS' });
    }
    const policyStatus = status || 'ACTIVE';

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({ error: 'At least one valid condition is required.', code: 'EMPTY_CONDITIONS' });
    }

    const uniqueConditions = new Set<string>();
    for (const c of conditions) {
      if (!VALID_INTERVENTION_CONDITION_TYPES.includes(c)) {
        return res.status(400).json({ error: `Invalid conditionType "${c}". Allowed: ${VALID_INTERVENTION_CONDITION_TYPES.join(', ')}`, code: 'INVALID_CONDITION_TYPE' });
      }
      if (uniqueConditions.has(c)) {
        return res.status(400).json({ error: `Duplicate condition "${c}" is not allowed in a single policy.`, code: 'DUPLICATE_CONDITION' });
      }
      uniqueConditions.add(c);
    }

    // Check duplicate code in tenant
    const [existing]: any = await pool.query(
      'SELECT id FROM project_intervention_policies WHERE tenantId = ? AND code = ?',
      [targetTenant, code.trim()]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: `Policy code "${code}" already exists for this tenant.`, code: 'DUPLICATE_POLICY_CODE' });
    }

    const policyId = `PIP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      await conn.query(`
        INSERT INTO project_intervention_policies (id, tenantId, code, name, description, severity, matchMode, status, createdById)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [policyId, targetTenant, code.trim(), name.trim(), description || null, severity, matchMode, policyStatus, actorUserId || 'SYSTEM']);

      for (const cond of conditions) {
        const condId = `PIPC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        await conn.query(`
          INSERT INTO project_intervention_policy_conditions (id, policyId, conditionType)
          VALUES (?, ?, ?)
        `, [condId, policyId, cond]);
      }

      await conn.commit();

      res.json({
        success: true,
        policy: {
          id: policyId,
          tenantId: targetTenant,
          code: code.trim(),
          name: name.trim(),
          description: description || null,
          severity,
          matchMode,
          status: policyStatus,
          createdById: actorUserId || 'SYSTEM',
          conditions
        }
      });
    } catch (e: any) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error('Error in POST /api/tenant/project-intervention-policies:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/tenant/project-intervention-policies/:id
// ─────────────────────────────────────────────────────────────
interventionPoliciesRoutes.put('/:id', async (req: Request, res: Response) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const hasManagePerm = actorRole === 'SUPER_ADMIN' ||
      actorPermissions.includes('ALL') ||
      actorPermissions.includes('MANAGE_TENANT');

    if (!hasManagePerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to update intervention policies.' });
    }

    const policyId = req.params.id;
    const { name, description, severity, matchMode, status, conditions } = req.body;

    if (severity && !VALID_INTERVENTION_SEVERITIES.includes(severity)) {
      return res.status(400).json({ error: `Invalid severity. Allowed: ${VALID_INTERVENTION_SEVERITIES.join(', ')}`, code: 'INVALID_SEVERITY' });
    }

    if (matchMode && matchMode !== 'ALL') {
      return res.status(400).json({ error: 'Invalid matchMode. Currently supported: ALL', code: 'INVALID_MATCH_MODE' });
    }

    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed: ACTIVE, INACTIVE', code: 'INVALID_STATUS' });
    }

    let validatedConditions: string[] | null = null;
    if (conditions !== undefined) {
      if (!Array.isArray(conditions) || conditions.length === 0) {
        return res.status(400).json({ error: 'At least one condition is required.', code: 'EMPTY_CONDITIONS' });
      }
      const uniqueConds = new Set<string>();
      for (const c of conditions) {
        if (!VALID_INTERVENTION_CONDITION_TYPES.includes(c)) {
          return res.status(400).json({ error: `Invalid conditionType "${c}". Allowed: ${VALID_INTERVENTION_CONDITION_TYPES.join(', ')}`, code: 'INVALID_CONDITION_TYPE' });
        }
        if (uniqueConds.has(c)) {
          return res.status(400).json({ error: `Duplicate condition "${c}" is not allowed.`, code: 'DUPLICATE_CONDITION' });
        }
        uniqueConds.add(c);
      }
      validatedConditions = Array.from(uniqueConds);
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      const [existing]: any = await conn.query(
        'SELECT * FROM project_intervention_policies WHERE id = ? AND tenantId = ? FOR UPDATE',
        [policyId, targetTenant]
      );

      if (existing.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Policy not found or cross-tenant violation.', code: 'POLICY_NOT_FOUND' });
      }

      await conn.query(`
        UPDATE project_intervention_policies
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            severity = COALESCE(?, severity),
            matchMode = COALESCE(?, matchMode),
            status = COALESCE(?, status)
        WHERE id = ? AND tenantId = ?
      `, [name || null, description !== undefined ? description : null, severity || null, matchMode || null, status || null, policyId, targetTenant]);

      if (validatedConditions) {
        await conn.query('DELETE FROM project_intervention_policy_conditions WHERE policyId = ?', [policyId]);
        for (const cond of validatedConditions) {
          const condId = `PIPC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          await conn.query(`
            INSERT INTO project_intervention_policy_conditions (id, policyId, conditionType)
            VALUES (?, ?, ?)
          `, [condId, policyId, cond]);
        }
      }

      await conn.commit();
      res.json({ success: true, policyId });
    } catch (e: any) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err: any) {
    console.error('Error in PUT /api/tenant/project-intervention-policies/:id:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/tenant/project-intervention-policies/:id/revisions
// ─────────────────────────────────────────────────────────────
interventionPoliciesRoutes.get('/:id/revisions', async (req: Request, res: Response) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const policyId = req.params.id;
    let revisions: any[] = [];
    try {
      const [rows]: any = await pool.query(
        'SELECT * FROM project_intervention_policy_revisions WHERE policyId = ? AND tenantId = ? ORDER BY revisionNumber DESC',
        [policyId, targetTenant]
      );
      revisions = rows;
    } catch {
      revisions = [];
    }

    res.json({
      policyId,
      tenantId: targetTenant,
      revisions
    });
  } catch (err: any) {
    console.error('Error in GET /api/tenant/project-intervention-policies/:id/revisions:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/tenant/analytics-settings
// ─────────────────────────────────────────────────────────────
tenantAnalyticsSettingsRoutes.get('/', async (req: Request, res: Response) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const [rows]: any = await pool.query(
      'SELECT settingKey, settingValue FROM tenant_settings WHERE tenantId = ?',
      [targetTenant]
    );

    const settingsMap: Record<string, any> = {};
    for (const r of rows) {
      settingsMap[r.settingKey] = r.settingValue;
    }

    res.json({
      tenantId: targetTenant,
      velocityMinComparisonSampleSize: settingsMap['velocityMinComparisonSampleSize'] ? parseInt(settingsMap['velocityMinComparisonSampleSize'], 10) : 5,
      settings: settingsMap
    });
  } catch (err: any) {
    console.error('Error in GET /api/tenant/analytics-settings:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/tenant/analytics-settings
// ─────────────────────────────────────────────────────────────
tenantAnalyticsSettingsRoutes.put('/', async (req: Request, res: Response) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  try {
    const hasManagePerm = actorRole === 'SUPER_ADMIN' ||
      actorPermissions.includes('ALL') ||
      actorPermissions.includes('MANAGE_TENANT');

    if (!hasManagePerm) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to update tenant analytics settings.' });
    }

    const { velocityMinComparisonSampleSize } = req.body;

    if (velocityMinComparisonSampleSize !== undefined && velocityMinComparisonSampleSize !== null) {
      const numVal = Number(velocityMinComparisonSampleSize);
      if (!Number.isInteger(numVal) || numVal <= 0) {
        return res.status(400).json({
          error: 'Invalid velocityMinComparisonSampleSize. Must be a positive integer greater than 0.',
          code: 'INVALID_VELOCITY_SAMPLE_SIZE'
        });
      }

      await pool.query(`
        INSERT INTO tenant_settings (id, tenantId, settingKey, settingValue)
        VALUES (?, ?, 'velocityMinComparisonSampleSize', ?)
        ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)
      `, [`TS-${targetTenant}-velocityMinSample`, targetTenant, String(numVal)]);
    }

    res.json({
      success: true,
      tenantId: targetTenant,
      velocityMinComparisonSampleSize: velocityMinComparisonSampleSize ? Number(velocityMinComparisonSampleSize) : 5
    });
  } catch (err: any) {
    console.error('Error in PUT /api/tenant/analytics-settings:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});
