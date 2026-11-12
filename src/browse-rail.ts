import { createRail } from './rail.ts';
import { writeSetting } from './settings.ts';
import { createCommands, type Command } from './commands.ts';
import { t } from './i18n.ts';

const routes = {
  home: { path: '/', root: 'ytd-browse[page-subtype="home"]:not([hidden])' },
  search: { path: '/results', root: 'ytd-search:not([hidden])' },
};

type BrowseSurface = keyof typeof routes;
const expandedBySurface = { home: true, search: true };

export function browseRootSelector(surface: BrowseSurface) {
  return routes[surface].root;
}

export function createBrowseRail(surface: BrowseSurface, anchor: Element) {
  const scope = new AbortController();
  const { signal } = scope;
  const rail = createRail(surface, expandedBySurface[surface], signal);
  const { host, shadow, toggle, restore, status, setExpanded } = rail;
  const styles = document.createElement('style');
  const selector = '[data-fovilo-' + surface + ']';
  styles.textContent = `
    ${selector} { color-scheme: light; }
    html[dark] ${selector} { color-scheme: dark; }
    ${surface === 'home' ? '[data-fovilo-home] { margin-inline: 16px; }' : ''}
  `;
  host.append(styles);
  let returning = false;

  function current() {
    return host.isConnected && location.pathname === routes[surface].path &&
      anchor.closest(routes[surface].root);
  }

  function toggleRail() {
    if (!current()) return;
    const expanded = !expandedBySurface[surface];
    expandedBySurface[surface] = expanded;
    setExpanded(expanded);
  }

  async function restoreYouTube() {
    if (!current() || returning) return;
    returning = true;
    restore.setAttribute('aria-disabled', 'true');
    try {
      await writeSetting('enabled', false);
    } catch {
      returning = false;
      restore.removeAttribute('aria-disabled');
      if (current()) status.textContent = t('settingsRetry');
    }
  }

  toggle.addEventListener('click', (event) => {
    if (event.isTrusted) toggleRail();
  }, { signal });
  restore.addEventListener('click', (event) => {
    if (event.isTrusted) void restoreYouTube();
  }, { signal });

  function addCommands(commands: Command[]) {
    const toggleLabel = t(surface === 'home' ? 'toggleHomeControls' : 'toggleSearchControls');
    const palette = createCommands(shadow, [
      ...commands,
      { id: surface + '.toggle-controls', label: toggleLabel, run: toggleRail },
      { id: 'return-native', label: t('returnNative'), run: restoreYouTube, remember: false },
    ], signal);
    restore.before(palette.trigger);
    return () => { if (current()) palette.open(true); };
  }

  function dispose() {
    if (returning && current() && document.activeElement === host) {
      document.querySelector<HTMLInputElement>('ytd-masthead input[name="search_query"]')?.focus({ preventScroll: true });
    }
    scope.abort();
    host.remove();
  }

  return { ...rail, signal, current, dispose, addCommands };
}
