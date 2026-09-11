/**
 * Centralized Role Normalization Utilities for SalesFlow Pro.
 * Guarantees consistent semantic role resolution across frontend & backend.
 *
 * Supports canonical names, Spring-style 'ROLE_' prefixes, and legacy DB codes (e.g. ROL-ADM-*).
 */

export function normalizeSemanticRole(role?: string | null, isPlatformUser?: boolean): string {
  if (isPlatformUser) return 'SUPER_ADMIN';
  if (!role) return 'SALES_REP';

  const upper = String(role).toUpperCase().trim();

  // 1. Super Admin Check
  if (upper === 'SUPER_ADMIN' || upper.endsWith('SUPER_ADMIN') || upper.includes('SUPER_ADMIN')) {
    return 'SUPER_ADMIN';
  }

  // 2. Tenant Admin Check
  if (
    upper === 'TENANT_ADMIN' ||
    upper.endsWith('TENANT_ADMIN') ||
    upper.startsWith('ROL-ADM') ||
    (upper.includes('ADMIN') && !upper.includes('SUPER'))
  ) {
    return 'TENANT_ADMIN';
  }

  // 3. Supervisor Check
  if (
    upper === 'SUPERVISOR' ||
    upper.endsWith('SUPERVISOR') ||
    upper.startsWith('ROL-SUP') ||
    upper.includes('SUPERVISOR')
  ) {
    return 'SUPERVISOR';
  }

  // 4. Sales Manager Check
  if (
    upper === 'SALES_MANAGER' ||
    upper.endsWith('SALES_MANAGER') ||
    upper.startsWith('ROL-MGR') ||
    upper.startsWith('ROL-MAN') ||
    upper.includes('MANAGER')
  ) {
    return 'SALES_MANAGER';
  }

  // 5. Sales Rep Check
  if (
    upper === 'SALES_REP' ||
    upper === 'SALES_REPRESENTATIVE' ||
    upper.endsWith('SALES_REP') ||
    upper.startsWith('ROL-REP') ||
    upper.includes('REP')
  ) {
    return 'SALES_REP';
  }

  return upper;
}

/**
 * Checks if a user has privilege to access 'all' scope (All Follow-ups / All Activities / All Tasks / All Visits).
 * Only TENANT_ADMIN, SUPERVISOR, and SUPER_ADMIN have this privilege.
 */
export function canAccessAllScope(role?: string | null, isPlatformUser?: boolean): boolean {
  const normalized = normalizeSemanticRole(role, isPlatformUser);
  return normalized === 'TENANT_ADMIN' || normalized === 'SUPERVISOR' || normalized === 'SUPER_ADMIN';
}
