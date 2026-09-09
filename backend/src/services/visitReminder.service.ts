import { pool } from '../db';
import { sendEmail } from './email.service';
import { getBusinessDate } from '../utils/date';

export const SENDING_TIMEOUT_MINUTES = 10;
export const EMAIL_MAX_RETRY_ATTEMPTS = 3;

export interface ReminderProcessResult {
  tenantsEvaluated: number;
  staleRecovered: number;
  processedVisits: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}

export function buildIdempotencyKey(
  tenantId: string,
  visitId: string,
  recipientEmail: string,
  reminderType: string,
  visitDate: string,
  visitStartTime: string
): string {
  return `${tenantId}:${visitId}:${recipientEmail.toLowerCase()}:${reminderType}:${visitDate}:${visitStartTime}`;
}

/**
 * Recovers stale SENDING occurrences where worker crashed or timed out.
 * Gate 11: Does not increment attemptCount during recovery itself.
 */
export async function recoverStaleSendingOccurrences(conn: any): Promise<number> {
  const [result]: any = await conn.query(`
    UPDATE visit_reminder_deliveries
    SET deliveryStatus = 'RETRY_PENDING',
        nextAttemptAt = NOW(),
        errorMessage = CONCAT('Recovered from stale SENDING state (timeout exceeded ', ?, ' minutes)'),
        updatedAt = NOW()
    WHERE deliveryStatus = 'SENDING'
      AND lastAttemptAt < DATE_SUB(NOW(), INTERVAL ? MINUTE)
  `, [SENDING_TIMEOUT_MINUTES, SENDING_TIMEOUT_MINUTES]);

  return result.affectedRows || 0;
}

/**
 * Loads authoritative tenant reminder settings.
 * Strict zero fallback: missing row throws configuration integrity error.
 */
export async function getAuthoritativeTenantReminderSettings(conn: any, tenantId: string) {
  const [rows]: any = await conn.query(
    'SELECT * FROM tenant_visit_reminder_settings WHERE tenantId = ?',
    [tenantId]
  );
  if (rows.length === 0) {
    throw new Error(`MISSING_TENANT_REMINDER_SETTINGS: Tenant ${tenantId} has no reminder settings row.`);
  }
  return rows[0];
}

/**
 * Resolves deduplicated recipient email addresses for a visit.
 * Gate 9: Primary PIC + internal participants + customer contacts in visit_participants.
 */
export async function resolveDeduplicatedVisitRecipients(conn: any, visitId: string, picId: string | null) {
  const recipientsMap = new Map<string, { email: string; role: string; userId: string | null }>();

  // 1. Primary PIC
  if (picId) {
    const [picRows]: any = await conn.query('SELECT id, email, name FROM users WHERE id = ?', [picId]);
    if (picRows.length > 0 && picRows[0].email) {
      const email = String(picRows[0].email).trim().toLowerCase();
      recipientsMap.set(email, { email, role: 'PIC', userId: picRows[0].id });
    }
  }

  // 2. Additional internal participants
  const [partUsers]: any = await conn.query(`
    SELECT vp.userId, u.email, u.name 
    FROM visit_participants vp
    JOIN users u ON u.id = vp.userId
    WHERE vp.visitId = ? AND vp.userId IS NOT NULL
  `, [visitId]);

  for (const pu of partUsers) {
    if (pu.email) {
      const email = String(pu.email).trim().toLowerCase();
      if (!recipientsMap.has(email)) {
        recipientsMap.set(email, { email, role: 'PARTICIPANT', userId: pu.userId });
      }
    }
  }

  // 3. Explicit customer contacts in visit_participants
  const [partContacts]: any = await conn.query(`
    SELECT vp.contactId, cc.email, cc.name 
    FROM visit_participants vp
    JOIN customer_contacts cc ON cc.id = vp.contactId
    WHERE vp.visitId = ? AND vp.contactId IS NOT NULL
  `, [visitId]);

  for (const pc of partContacts) {
    if (pc.email) {
      const email = String(pc.email).trim().toLowerCase();
      if (!recipientsMap.has(email)) {
        recipientsMap.set(email, { email, role: 'CUSTOMER_CONTACT', userId: null });
      }
    }
  }

  return Array.from(recipientsMap.values());
}

/**
 * Executes the core reminder processing cycle.
 */
export async function executeReminderProcessing(
  conn: any,
  options?: { tenantId?: string; forceDate?: string }
): Promise<ReminderProcessResult> {
  const result: ReminderProcessResult = {
    tenantsEvaluated: 0,
    staleRecovered: 0,
    processedVisits: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
  };

  // Step 1: Recover stale SENDING occurrences across the system (Gate 11)
  result.staleRecovered = await recoverStaleSendingOccurrences(conn);

  // Step 2: Determine target tenants
  let tenants: any[] = [];
  if (options?.tenantId) {
    const [tRows]: any = await conn.query('SELECT id, status FROM tenants WHERE id = ?', [options.tenantId]);
    tenants = tRows;
  } else {
    const [tRows]: any = await conn.query("SELECT id, status FROM tenants WHERE status = 'ACTIVE'");
    tenants = tRows;
  }

  const todayStr = options?.forceDate || getBusinessDate(new Date())!;

  // Step 3: Iterate through tenants
  for (const tenant of tenants) {
    let settings: any;
    try {
      settings = await getAuthoritativeTenantReminderSettings(conn, tenant.id);
    } catch (err: any) {
      console.error(`[REMINDER_WORKER] Configuration integrity error for tenant ${tenant.id}:`, err.message);
      continue;
    }

    result.tenantsEvaluated++;

    if (!settings.emailReminderEnabled) {
      continue;
    }

    const emailOffsetDays = Number(settings.emailReminderDaysBefore);
    const immediateInsideWindow = Boolean(settings.immediateReminderInsideWindowEnabled);

    // Gate 1: Use vs.isTerminal = 0 (Zero physical VS-* IDs)
    const [visits]: any = await conn.query(`
      SELECT 
        v.id, v.tenantId, v.title, v.customerId, v.picId,
        DATE_FORMAT(v.visitDate, '%Y-%m-%d') as visitDateStr,
        TIME_FORMAT(v.startTime, '%H:%i:%s') as startTimeStr,
        TIME_FORMAT(v.endTime, '%H:%i:%s') as endTimeStr,
        v.location, v.notes,
        c.name as customerName, c.code as customerCode,
        u.name as picName, u.email as picEmail
      FROM visits v
      JOIN visit_statuses vs ON vs.id = v.statusId
      JOIN customers c ON c.id = v.customerId
      LEFT JOIN users u ON u.id = v.picId
      WHERE v.tenantId = ?
        AND vs.isTerminal = 0
        AND v.visitDate >= ?
        AND v.visitDate <= DATE_ADD(?, INTERVAL ? DAY)
    `, [tenant.id, todayStr, todayStr, emailOffsetDays]);

    for (const visit of visits) {
      result.processedVisits++;
      const vDateStr = visit.visitDateStr;
      const vTimeStr = visit.startTimeStr || '00:00:00';

      // Evaluate whether reminder is due
      // In normal mode: due if todayStr >= (visitDate - emailOffsetDays) AND todayStr <= visitDate
      // If immediateInsideWindow is false and visit was created late: skip if not exact offset date
      if (!immediateInsideWindow && vDateStr !== todayStr) {
        const [exactMatch]: any = await conn.query(
          'SELECT DATEDIFF(?, ?) as diff',
          [vDateStr, todayStr]
        );
        if (exactMatch[0]?.diff !== emailOffsetDays) {
          continue;
        }
      }

      // Resolve deduplicated recipients
      const recipients = await resolveDeduplicatedVisitRecipients(conn, visit.id, visit.picId);

      for (const recipient of recipients) {
        // Gate 4: Canonical date + time idempotency key
        const idempotencyKey = buildIdempotencyKey(tenant.id, visit.id, recipient.email, 'EMAIL_REMINDER', vDateStr, vTimeStr);

        // Check or insert into visit_reminder_deliveries
        const [existingRows]: any = await conn.query(
          'SELECT * FROM visit_reminder_deliveries WHERE idempotencyKey = ?',
          [idempotencyKey]
        );

        let deliveryRowId: string;

        if (existingRows.length === 0) {
          deliveryRowId = `VRD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          try {
            await conn.query(`
              INSERT INTO visit_reminder_deliveries (
                id, tenantId, visitId, recipientUserId, recipientEmail, recipientRole,
                reminderType, visitDate, visitStartTime, scheduledOffsetDays,
                deliveryStatus, attemptCount, nextAttemptAt, idempotencyKey, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, 'EMAIL_REMINDER', ?, ?, ?, 'PENDING', 0, NOW(), ?, NOW(), NOW())
            `, [
              deliveryRowId,
              tenant.id,
              visit.id,
              recipient.userId,
              recipient.email,
              recipient.role,
              vDateStr,
              vTimeStr,
              emailOffsetDays,
              idempotencyKey
            ]);
          } catch (dupErr: any) {
            const [retryRow]: any = await conn.query('SELECT id FROM visit_reminder_deliveries WHERE idempotencyKey = ?', [idempotencyKey]);
            if (retryRow.length === 0) continue;
            deliveryRowId = retryRow[0].id;
          }
        } else {
          const row = existingRows[0];
          deliveryRowId = row.id;

          if (row.deliveryStatus === 'SENT' || row.deliveryStatus === 'OBSOLETE' || row.deliveryStatus === 'SKIPPED' || row.deliveryStatus === 'FAILED') {
            result.skippedCount++;
            continue;
          }
        }

        // Gate 5: Atomic claim
        const [claimRes]: any = await conn.query(`
          UPDATE visit_reminder_deliveries
          SET deliveryStatus = 'SENDING',
              lastAttemptAt = NOW(),
              attemptCount = attemptCount + 1,
              updatedAt = NOW()
          WHERE id = ?
            AND deliveryStatus IN ('PENDING', 'RETRY_PENDING')
            AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())
        `, [deliveryRowId]);

        if (claimRes.affectedRows !== 1) {
          result.skippedCount++;
          continue;
        }

        // Worker successfully owns SENDING! Dispatch email
        try {
          const subject = `[Reminder] Upcoming Visit: ${visit.title} with ${visit.customerName}`;
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px;">
              <h2 style="color: #4744e5; margin-top: 0;">SalesFlow Pro — Field Visit Reminder</h2>
              <p>Hello,</p>
              <p>This is an automated reminder for your upcoming scheduled customer visit:</p>
              <div style="background-color: #f8fafc; border-left: 4px solid #4744e5; padding: 12px 16px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Customer:</strong> ${visit.customerName} (${visit.customerCode || 'N/A'})</p>
                <p style="margin: 4px 0;"><strong>Visit Title:</strong> ${visit.title}</p>
                <p style="margin: 4px 0;"><strong>Date:</strong> ${vDateStr}</p>
                <p style="margin: 4px 0;"><strong>Time:</strong> ${vTimeStr} - ${visit.endTimeStr || ''}</p>
                <p style="margin: 4px 0;"><strong>Location:</strong> ${visit.location || 'Not specified'}</p>
                <p style="margin: 4px 0;"><strong>Primary PIC:</strong> ${visit.picName || 'Unassigned'}</p>
                ${visit.notes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${visit.notes}</p>` : ''}
              </div>
              <p style="font-size: 12px; color: #64748b;">Please ensure you are prepared with the relevant meeting materials.</p>
            </div>
          `;

          await sendEmail({
            to: recipient.email,
            subject,
            html: htmlContent,
            text: `Reminder: Upcoming visit '${visit.title}' with ${visit.customerName} scheduled for ${vDateStr} at ${vTimeStr}.`
          });

          await conn.query(`
            UPDATE visit_reminder_deliveries
            SET deliveryStatus = 'SENT',
                sentAt = NOW(),
                errorMessage = NULL,
                updatedAt = NOW()
            WHERE id = ? AND deliveryStatus = 'SENDING'
          `, [deliveryRowId]);

          result.sentCount++;
        } catch (sendErr: any) {
          const [curRow]: any = await conn.query('SELECT attemptCount FROM visit_reminder_deliveries WHERE id = ?', [deliveryRowId]);
          const currentAttempts = curRow[0]?.attemptCount || 1;
          const isFinalFailure = currentAttempts >= EMAIL_MAX_RETRY_ATTEMPTS;

          const backoffMinutes = currentAttempts === 1 ? 5 : 15;
          const targetStatus = isFinalFailure ? 'FAILED' : 'RETRY_PENDING';
          const errMsg = sendErr?.message || 'Failed to dispatch email';

          await conn.query(`
            UPDATE visit_reminder_deliveries
            SET deliveryStatus = ?,
                nextAttemptAt = CASE WHEN ? THEN NULL ELSE DATE_ADD(NOW(), INTERVAL ? MINUTE) END,
                errorMessage = ?,
                updatedAt = NOW()
            WHERE id = ? AND deliveryStatus = 'SENDING'
          `, [targetStatus, isFinalFailure, backoffMinutes, errMsg, deliveryRowId]);

          result.failedCount++;
        }
      }
    }
  }

  return result;
}
