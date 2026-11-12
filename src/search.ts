import { createRail } from './rail.ts';
import { writeSetting } from './settings.ts';

let expanded = true;
let compact = false;

const results = 'ytd-search #primary:has(> [data-fovilo-search][data-fovilo-density="compact"]) ' +
  'ytd-item-section-renderer > #contents > ytd-video-renderer';

export function mountSearch(anchor: Element) {
  const scope = new AbortController();
  const { signal } = scope;
  const { host, toggle, actions, restore, status, setExpanded } = createRail('search', expanded, signal);
  const styles = document.createElement('style');
  styles.textContent = `
    [data-fovilo-search] { color-scheme: light; }
    html[dark] [data-fovilo-search] { color-scheme: dark; }
    ${results} { margin-block-start: 8px; }
    @media (min-width: 1000px) {
      ${results} #dismissible > ytd-thumbnail { max-inline-size: 360px; }
    }
  `;
  host.append(styles);

  const density = document.createElement('button');
  density.textContent = 'Compact results';
  actions.append(density);
  let returning = false;

  function current() {
    return host.isConnected && location.pathname === '/results' && anchor.closest('ytd-search:not([hidden])');
  }

  function showDensity() {
    host.dataset.foviloDensity = compact ? 'compact' : 'comfortable';
    density.setAttribute('aria-pressed', String(compact));
    toggle.textContent = compact ? 'Search controls · Compact' : 'Search controls';
  }
  showDensity();

  toggle.addEventListener('click', (event) => {
    if (!event.isTrusted || !current()) return;
    expanded = !expanded;
    setExpanded(expanded);
  }, { signal });

  density.addEventListener('click', (event) => {
    if (!event.isTrusted || !current()) return;
    compact = !compact;
    showDensity();
    status.textContent = compact ? 'Compact search results.' : 'Standard search spacing restored.';
  }, { signal });

  restore.addEventListener('click', async (event) => {
    if (!event.isTrusted || !current() || returning) return;
    returning = true;
    restore.setAttribute('aria-disabled', 'true');
    try {
      await writeSetting('enabled', false);
    } catch {
      returning = false;
      restore.removeAttribute('aria-disabled');
      if (current()) status.textContent = 'Could not save the setting. Try again.';
    }
  }, { signal });

  anchor.prepend(host);
  return {
    anchor,
    host,
    dispose() {
      if (returning && current() && document.activeElement === host) {
        document.querySelector<HTMLInputElement>('ytd-masthead input[name="search_query"]')?.focus({ preventScroll: true });
      }
      scope.abort();
      host.remove();
    },
  };
}
