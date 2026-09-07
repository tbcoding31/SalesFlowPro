import { Router } from 'express';
import { pool } from '../db';
import { buildReportScopeWhere, validateTargetTenant } from '../utils/scope';

export const tasksRoutes = Router();

// GET /api/tasks - List tasks with pagination, customerId, status, search
tasksRoutes.get('/', async (req: any, res: any) => {
  const actorRole = (req as any).userRole;
  const actorTenant = (req as any).userTenantId;
  const actorUserId = (req as any).userId;
  const actorDataScope = (req as any).userDataScope || 'OWN';
  const actorPermissions = (req as any).userPermissions || [];
  const isPlatformUser = (req as any).isPlatformUser;

  if ((!actorTenant && !isPlatformUser) || !actorRole) return res.status(401).json({ error: 'Unauthorized' });

  const targetTenant = await validateTargetTenant(req, res, pool, actorTenant);
  if (targetTenant === false) return;

  const { where, params } = buildReportScopeWhere(targetTenant, actorUserId, actorRole, actorDataScope, actorPermissions, 't.picId');

  try {
    let extraWhere = '';
    const extraParams: any[] = [];

    const { customerId, picId, status, priority, search, page, pageSize } = req.query;

    if (customerId && customerId !== 'ALL') {
      extraWhere += ' AND t.customerId = ?';
      extraParams.push(customerId);
    }

    if (picId && picId !== 'ALL') {
      extraWhere += ' AND t.picId = ?';
      extraParams.push(picId);
    }

    if (status && status !== 'ALL') {
      extraWhere += ' AND (t.statusId = ? OR ts.code = ? OR ts.name = ?)';
      extraParams.push(status, status, status);
    }

    if (priority && priority !== 'ALL') {
      extraWhere += ' AND (t.priorityId = ? OR tp.code = ? OR tp.name = ?)';
      extraParams.push(priority, priority, priority);
    }

    if (search && typeof search === 'string' && search.trim()) {
      extraWhere += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      const s = `%${search.trim()}%`;
      extraParams.push(s, s);
    }

    const countSql = `
      SELECT COUNT(t.id) as total
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId
      LEFT JOIN task_priorities tp ON tp.id = t.priorityId
      ${where.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
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
        t.*,
        ts.code as statusCode, ts.name as statusName, ts.color as statusColor,
        tp.code as priorityCode, tp.name as priorityName, tp.color as priorityColor,
        u.name as picName, u.email as picEmail, u.avatar as picAvatar,
        c.name as customerName, c.code as customerCode
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.statusId
      LEFT JOIN task_priorities tp ON tp.id = t.priorityId
      LEFT JOIN users u ON u.id = t.picId
      LEFT JOIN customers c ON c.id = t.customerId
      ${where.replace(/WHERE tenantId/g, 'WHERE t.tenantId')}
      ${extraWhere}
      ORDER BY t.dueDate ASC, t.createdAt DESC
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
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

