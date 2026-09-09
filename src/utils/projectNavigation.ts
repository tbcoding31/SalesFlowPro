export type ProjectView = 'list' | 'pipeline';
export type ProjectEntrySource = 'list' | 'pipeline' | 'detail' | 'direct';

export interface ProjectNavigationContext {
  view: ProjectView;
  from: ProjectView;
  entry: ProjectEntrySource;
}

/**
 * Resolves navigation context from URLSearchParams or query string.
 * Invariants:
 * - `view`: 'list' | 'pipeline' (defaults to fallbackView, which defaults to 'list').
 * - `from`: strictly 'list' | 'pipeline' (collection view authority). Never 'detail'.
 * - `entry`: strictly 'list' | 'pipeline' | 'detail' | 'direct' (immediate Edit entry path).
 * - When entry is missing/direct, fallback from is 'list' and entry is 'direct'.
 * - Contradictory states like from='detail'&entry='pipeline' are impossible.
 */
export function resolveProjectNavigation(
  searchParams?: URLSearchParams | string | null,
  fallbackView: ProjectView = 'list'
): ProjectNavigationContext {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(searchParams)
      : searchParams || new URLSearchParams();

  const rawView = (params.get('view') || '').toLowerCase().trim();
  const rawFrom = (params.get('from') || '').toLowerCase().trim();
  const rawEntry = (params.get('entry') || '').toLowerCase().trim();

  const view: ProjectView = rawView === 'pipeline' ? 'pipeline' : (rawView === 'list' ? 'list' : fallbackView);

  let from: ProjectView = fallbackView;
  if (rawFrom === 'pipeline') {
    from = 'pipeline';
  } else if (rawFrom === 'list') {
    from = 'list';
  } else if (rawView === 'pipeline' || rawView === 'list') {
    from = rawView;
  }

  let entry: ProjectEntrySource = 'direct';
  if (rawEntry === 'list' || rawEntry === 'pipeline' || rawEntry === 'detail') {
    entry = rawEntry;
  } else if (rawFrom === 'list' || rawFrom === 'pipeline') {
    entry = rawFrom;
  }

  return { view, from, entry };
}

/**
 * Builds the canonical URL for the project collection page with view parameter.
 */
export function buildProjectsUrl(params?: { view?: ProjectView }): string {
  const view = params?.view || 'list';
  return `/projects?view=${view}`;
}

/**
 * Builds the canonical URL for Project Detail preserving the originating collection view.
 */
export function buildProjectDetailUrl(
  id: string | number,
  context?: { from?: ProjectView }
): string {
  if (context?.from) {
    return `/projects/${id}?from=${context.from}`;
  }
  return `/projects/${id}`;
}

/**
 * Builds the canonical URL for Edit Project with entry path and collection origin.
 */
export function buildProjectEditUrl(
  id: string | number,
  context?: { entry?: ProjectEntrySource; from?: ProjectView }
): string {
  const params = new URLSearchParams();
  if (context?.entry) {
    params.set('entry', context.entry);
  }
  if (context?.from) {
    params.set('from', context.from);
  }
  const qs = params.toString();
  return `/projects/${id}/edit${qs ? '?' + qs : ''}`;
}

/**
 * Resolves the canonical return URL for Edit Project (Cancel, Back, Save).
 * Invariants:
 * - 'list' -> /projects?view=list
 * - 'pipeline' -> /projects?view=pipeline
 * - 'detail' -> /projects/:id?from=${from}
 * - 'direct' -> /projects?view=list (MUST NOT fabricate detail history)
 */
export function getProjectEditReturnUrl(
  id: string | number,
  context: ProjectNavigationContext
): string {
  if (context.entry === 'list') {
    return '/projects?view=list';
  }
  if (context.entry === 'pipeline') {
    return '/projects?view=pipeline';
  }
  if (context.entry === 'detail') {
    return buildProjectDetailUrl(id, { from: context.from });
  }
  // Direct entry fallback: returns to collection list view without fabricating detail history
  return '/projects?view=list';
}

/**
 * Resolves the canonical return URL for Project Detail Back button and root breadcrumb.
 */
export function getProjectDetailBackUrl(from: ProjectView): string {
  if (from === 'pipeline') {
    return '/projects?view=pipeline';
  }
  return '/projects?view=list';
}
