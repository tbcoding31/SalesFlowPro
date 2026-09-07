import { Router } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';

export const visitsRoutes = Router();

// GET /api/visits - List visits with pagination, customerId, status, search
visitsRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'v.picId');

  try {
    let extraWhere = '';
    const extraParams: any[] = [];

    const { customerId, picId, status, search, page, pageSize, startDate, endDate } = req.query;

    if (customerId && customerId !== 'ALL') {
      extraWhere += ' AND v.customerId = ?';
      extraParams.push(customerId);
    }

    if (picId && picId !== 'ALL') {
      extraWhere += ' AND v.picId = ?';
      extraParams.push(picId);
    }

    if (status && status !== 'ALL') {
      extraWhere += ' AND (v.statusId = ? OR vs.code = ? OR vs.name = ?)';
      extraParams.push(status, status, status);
    }

    if (startDate) {
      extraWhere += ' AND v.visitDate >= ?';
      extraParams.push(startDate);
    }

    if (endDate) {
      extraWhere += ' AND v.visitDate <= ?';
      extraParams.push(endDate);
    }

    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (v.title LIKE ? OR v.location LIKE ? OR v.result LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s, s);
    }

    const countSql = `
      SELECT COUNT(v.id) as total
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId
      LEFT JOIN visit_purposes vp ON vp.id = v.purposeId
      ${where.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
      ${extraWhere}
    `;
    const [countRows]: any = await pool.query(countSql, [...params, ...extraParams]);
    const totalItems = countRows[0]?.total || 0;

    let paginationClause = '';
    const pNum = parseInt(page as string, 10);
    const pSize = parseInt(pageSize as string, 10);
    if (!isNaN(pNum) && !isNaN(pSize) && pNum > 0 && pSize > 0) {
      const offset = (pNum - 1) * pSize;
      paginationClause = ` LIMIT ${pSize} OFFSET ${offset}`;
    }

    const selectSql = `
      SELECT 
        v.*,
        vs.code as statusCode, vs.name as statusName,
        vp.code as purposeCode, vp.name as purposeName,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        c.name as customerName, c.code as customerCode
      FROM visits v
      LEFT JOIN visit_statuses vs ON vs.id = v.statusId
      LEFT JOIN visit_purposes vp ON vp.id = v.purposeId
      LEFT JOIN users u ON u.id = v.picId
      LEFT JOIN customers c ON c.id = v.customerId
      ${where.replace(/WHERE tenantId/g, 'WHERE v.tenantId')}
      ${extraWhere}
      ORDER BY v.visitDate DESC, v.createdAt DESC
      ${paginationClause}
    `;

    const [rows]: any = await pool.query(selectSql, [...params, ...extraParams]);

    if (!isNaN(pNum) && !isNaN(pSize) && pNum > 0 && pSize > 0) {
      const totalPages = Math.ceil(totalItems / pSize) || 1;
      res.json({
        data: rows,
        pagination: {
          page: pNum,
          pageSize: pSize,
          totalItems,
          totalPages
        }
      });
    } else {
      res.json(rows);
    }
  } catch (err: any) {
    console.error('GET /api/visits error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

