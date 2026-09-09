import { pool } from '../db';
import { executeReminderProcessing } from '../services/visitReminder.service';

export interface WorkerRunResult {
  executed: boolean;
  skipped?: boolean;
  reason?: string;
  stats?: any;
}

/**
 * Gate 6: Scheduler singleton worker using MySQL GET_LOCK.
 * Multi-replica safe.
 */
export async function runVisitReminderWorker(options?: { tenantId?: string; forceDate?: string }): Promise<WorkerRunResult> {
  const conn = await pool.getConnection();
  try {
    // Acquire singleton lock with zero timeout
    const [lockRes]: any = await conn.query("SELECT GET_LOCK('salesflow:visit-reminder-worker', 0) as lockAcquired");
    const acquired = lockRes[0]?.lockAcquired === 1;

    if (!acquired) {
      return {
        executed: false,
        skipped: true,
        reason: 'LOCK_UNAVAILABLE_ANOTHER_INSTANCE_ACTIVE'
      };
    }

    try {
      const stats = await executeReminderProcessing(conn, options);
      return {
        executed: true,
        stats
      };
    } finally {
      // Always release lock
      await conn.query("SELECT RELEASE_LOCK('salesflow:visit-reminder-worker')");
    }
  } finally {
    conn.release();
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Starts the background interval runner (every 15 minutes).
 */
export function startVisitReminderScheduler(intervalMs = 15 * 60 * 1000) {
  if (schedulerTimer) return;
  if (process.env.NODE_ENV === 'test') return;

  console.log('[REMINDER_SCHEDULER] Starting visit reminder background scheduler...');
  
  // Run once shortly after startup (after 5 seconds)
  setTimeout(() => {
    runVisitReminderWorker().catch(err => {
      console.error('[REMINDER_SCHEDULER] Initial run error:', err);
    });
  }, 5000);

  schedulerTimer = setInterval(() => {
    runVisitReminderWorker().catch(err => {
      console.error('[REMINDER_SCHEDULER] Background run error:', err);
    });
  }, intervalMs);
}

export function stopVisitReminderScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
