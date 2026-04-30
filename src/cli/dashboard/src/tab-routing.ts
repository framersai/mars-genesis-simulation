export const DASHBOARD_TABS = ['quickstart', 'sim', 'viz', 'settings', 'reports', 'chat', 'library', 'studio', 'about'] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

/** Sub-tab identifier within a parent tab (Studio / Settings). Threaded
 *  through getDashboardTabFromHref so deep links like ?tab=branches and
 *  ?tab=log redirect to studio + log within the parent panel. */
export type DashboardSubTab = 'author' | 'branches' | 'config' | 'log';

/** Legacy top-level tabs that are now sub-tabs of another panel. Reading
 *  one of these from a URL redirects the active tab to the parent and
 *  hands the sub-tab id back to the consumer so the parent can mount
 *  on the correct sub-panel. */
const LEGACY_REDIRECTS: Record<string, { tab: DashboardTab; sub: DashboardSubTab }> = {
  branches: { tab: 'studio', sub: 'branches' },
  log: { tab: 'settings', sub: 'log' },
};

function isDashboardTab(value: string | null | undefined): value is DashboardTab {
  return !!value && DASHBOARD_TABS.includes(value as DashboardTab);
}

export function getDashboardTabFromHref(href: string): DashboardTab {
  const { tab } = getDashboardTabAndSubFromHref(href);
  return tab;
}

export function getDashboardTabAndSubFromHref(href: string): { tab: DashboardTab; sub?: DashboardSubTab } {
  const url = new URL(href);
  const tabParam = url.searchParams.get('tab');
  const subParam = url.searchParams.get('sub') as DashboardSubTab | null;

  if (tabParam && LEGACY_REDIRECTS[tabParam]) {
    return LEGACY_REDIRECTS[tabParam];
  }
  if (isDashboardTab(tabParam)) {
    return { tab: tabParam, sub: subParam ?? undefined };
  }

  const hash = url.hash.replace(/^#/, '');
  if (hash && LEGACY_REDIRECTS[hash]) {
    return LEGACY_REDIRECTS[hash];
  }
  if (isDashboardTab(hash)) {
    return { tab: hash, sub: subParam ?? undefined };
  }

  return { tab: 'quickstart' };
}

export function createDashboardTabHref(currentHref: string, tab: Exclude<DashboardTab, 'about'>): string {
  const url = new URL(currentHref);
  url.searchParams.set('tab', tab);
  url.hash = '';
  return url.toString();
}

export function resolveSetupRedirectHref(currentHref: string, redirect: string | null | undefined): string {
  if (!redirect) {
    return createDashboardTabHref(currentHref, 'sim');
  }

  const currentUrl = new URL(currentHref);
  const targetUrl = new URL(redirect, currentUrl.origin);

  if (targetUrl.pathname === '/sim' && !targetUrl.searchParams.has('tab')) {
    targetUrl.searchParams.set('tab', 'sim');
  }

  targetUrl.hash = '';
  return targetUrl.toString();
}
