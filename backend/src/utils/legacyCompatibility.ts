/**
 * @file legacyCompatibility.ts
 * @description Dedicated legacy compatibility helper for read-only historical transactions.
 * 
 * BOUNDARY OF USE:
 * - Used ONLY when reading legacy records where foreign keys predated UAT-064 two-tier master architecture.
 * - NEVER used as runtime authority.
 * - NEVER used to override tenant master lookup, set default values, or create new transactions.
 * - Tenant-scoped master data rows (joined via master.id = tx.masterId AND master.tenantId = tx.tenantId)
 *   ALWAYS take precedence over any legacy fallback.
 */

export interface LegacyStatusResolution {
  isResolved: boolean;
  semanticCode: string | null;
  isTerminal: boolean;
}

/**
 * Resolves legacy unmigrated status string if and only if tenant master data join returned NULL.
 * @param legacyValue - The unmapped status string from historical transaction
 * @param domain - Domain category ('TASK' | 'VISIT' | 'PROJECT' | 'CUSTOMER')
 */
export function resolveLegacySemanticStatus(
  legacyValue: string | null | undefined,
  domain: 'TASK' | 'VISIT' | 'PROJECT' | 'CUSTOMER'
): LegacyStatusResolution {
  if (!legacyValue) {
    return { isResolved: false, semanticCode: null, isTerminal: false };
  }

  const normalized = legacyValue.trim().toUpperCase();

  switch (domain) {
    case 'TASK':
      if (normalized === 'COMPLETED' || normalized === 'TSK_COMPLETED') {
        return { isResolved: true, semanticCode: 'COMPLETED', isTerminal: true };
      }
      if (normalized === 'CANCELLED' || normalized === 'TSK_CANCELLED') {
        return { isResolved: true, semanticCode: 'CANCELLED', isTerminal: true };
      }
      if (normalized === 'IN_PROGRESS' || normalized === 'TSK_INPROGRESS') {
        return { isResolved: true, semanticCode: 'IN_PROGRESS', isTerminal: false };
      }
      if (normalized === 'TODO' || normalized === 'TSK_TODO') {
        return { isResolved: true, semanticCode: 'TODO', isTerminal: false };
      }
      break;

    case 'VISIT':
      if (normalized === 'COMPLETED') {
        return { isResolved: true, semanticCode: 'COMPLETED', isTerminal: true };
      }
      if (normalized === 'CANCELLED') {
        return { isResolved: true, semanticCode: 'CANCELLED', isTerminal: true };
      }
      if (normalized === 'SCHEDULED' || normalized === 'PLANNED') {
        return { isResolved: true, semanticCode: 'SCHEDULED', isTerminal: false };
      }
      break;

    case 'PROJECT':
      if (normalized === 'WON') {
        return { isResolved: true, semanticCode: 'WON', isTerminal: true };
      }
      if (normalized === 'LOST') {
        return { isResolved: true, semanticCode: 'LOST', isTerminal: true };
      }
      break;

    case 'CUSTOMER':
      if (normalized === 'INACTIVE') {
        return { isResolved: true, semanticCode: 'INACTIVE', isTerminal: false };
      }
      if (normalized === 'ACTIVE') {
        return { isResolved: true, semanticCode: 'ACTIVE', isTerminal: false };
      }
      break;
  }

  return { isResolved: false, semanticCode: null, isTerminal: false };
}
