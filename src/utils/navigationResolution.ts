import { AppMenuItem } from '../types';

export interface ActiveMenuResolution {
  activeNode: AppMenuItem | null;
  activeCode: string | null;
  activeId: string | null;
  ancestors: AppMenuItem[];
  ancestorKeys: Set<string>;
}

/**
 * Resolves the currently active menu node and its entire ancestor chain
 * based on the browser's pathname and search parameters.
 *
 * Supports:
 * - Exact pathname and query parameter matching (e.g. /tasks?scope=my vs /tasks?scope=all)
 * - Dashboard route resolution for root '/' landing
 * - Child and detail routes fallback (e.g. /visits/:id, /projects/:id, /customers/:id)
 * - Dynamic nested DB-authoritative menus without hardcoded codes
 */
export function resolveActiveMenuAndAncestors(
  menuTree: AppMenuItem[],
  pathname: string,
  search: string = ''
): ActiveMenuResolution {
  const normPath = pathname.trim().replace(/\/+$/, '') || '/';
  const currParams = new URLSearchParams(search || '');

  let bestNode: AppMenuItem | null = null;
  let bestScore = 0;
  let bestAncestors: AppMenuItem[] = [];

  function traverse(nodes: AppMenuItem[], currentAncestors: AppMenuItem[]) {
    for (const node of nodes) {
      if (node.route) {
        const [targetPathRaw, targetQueryRaw] = node.route.split('?');
        const targetPath = targetPathRaw.trim().replace(/\/+$/, '') || '/';
        const targetParams = new URLSearchParams(targetQueryRaw || '');

        let queryMatches = true;
        let queryScoreBonus = 0;

        if (targetQueryRaw) {
          targetParams.forEach((val, key) => {
            const currVal = currParams.get(key);
            if (currVal === val) {
              queryScoreBonus += 25;
            } else if (!currParams.has(key) && key === 'scope' && val === 'my') {
              // Application default scope fallback (tasks/visits default to 'my')
              queryScoreBonus += 10;
            } else {
              queryMatches = false;
            }
          });
        }

        if (queryMatches) {
          let pathScore = 0;
          const isExact =
            normPath === targetPath ||
            (normPath === '/' && (targetPath === '/dashboard' || targetPath === '/admin/dashboard'));

          if (isExact) {
            pathScore = 100;
          } else if (normPath.startsWith(targetPath + '/')) {
            // Child route matching (e.g. /visits/VIS-123 under /visits)
            pathScore = 50 + targetPath.length;
          }

          if (pathScore > 0) {
            // Leaf item bonus and depth bonus so specific leaf items are preferred over parent container routes
            const leafBonus = node.menuType === 'ITEM' ? 10 : 0;
            const depthBonus = currentAncestors.length * 2;
            const totalScore = pathScore + queryScoreBonus + leafBonus + depthBonus;
            if (totalScore > bestScore) {
              bestScore = totalScore;
              bestNode = node;
              bestAncestors = [...currentAncestors];
            }
          }
        }
      }

      if (node.children && node.children.length > 0) {
        traverse(node.children, [...currentAncestors, node]);
      }
    }
  }

  traverse(menuTree, []);

  const ancestorKeys = new Set<string>();
  bestAncestors.forEach((a) => {
    if (a.id) ancestorKeys.add(a.id);
    if (a.code) ancestorKeys.add(a.code);
    if (a.label) ancestorKeys.add(a.label);
  });

  // If the resolved active node itself is a container (SUBMENU or GROUP) with children, ensure it expands
  if (bestNode && (bestNode as any).children && (bestNode as any).children.length > 0) {
    if (bestNode.id) ancestorKeys.add(bestNode.id);
    if (bestNode.code) ancestorKeys.add(bestNode.code);
    if (bestNode.label) ancestorKeys.add(bestNode.label);
  }

  return {
    activeNode: bestNode,
    activeCode: bestNode ? bestNode.code : null,
    activeId: bestNode ? bestNode.id : null,
    ancestors: bestAncestors,
    ancestorKeys
  };
}
