import { Router } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';

export const followupsRoutes = Router();

// GET /api/followups - List follow-ups with pagination, customerId, status, search
followupsRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 'f.picId');

  try {
    let extraWhere = '';
    const extraParams: any[] = [];

    const { customerId, picId, status, priority, search, page, pageSize } = req.query;

    if (customerId && customerId !== 'ALL') {
      extraWhere += ' AND f.customerId = ?';
      extraParams.push(customerId);
    }

    if (picId && picId !== 'ALL') {
      extraWhere += ' AND f.picId = ?';
      extraParams.push(picId);
    }

    if (status && status !== 'ALL') {
      extraWhere += ' AND f.status = ?';
      extraParams.push(status);
    }

    if (priority && priority !== 'ALL') {
      extraWhere += ' AND f.priorityId = ?';
      extraParams.push(priority);
    }

    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (f.title LIKE ? OR f.notes LIKE ? OR f.outcome LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s, s);
    }

    const countSql = `
      SELECT COUNT(f.id) as total
      FROM follow_ups f
      LEFT JOIN follow_up_types ft ON ft.id = f.typeId
      ${where.replace(/WHERE tenantId/g, 'WHERE f.tenantId')}
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
        f.*,
        ft.code as typeCode, ft.name as typeName,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        c.name as customerName, c.code as customerCode
      FROM follow_ups f
      LEFT JOIN follow_up_types ft ON ft.id = f.typeId
      LEFT JOIN users u ON u.id = f.picId
      LEFT JOIN customers c ON c.id = f.customerId
      ${where.replace(/WHERE tenantId/g, 'WHERE f.tenantId')}
      ${extraWhere}
      ORDER BY f.followUpDate DESC, f.createdAt DESC
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
    console.error('GET /api/followups error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

