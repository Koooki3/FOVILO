import { createBrowseRail } from './browse-rail.ts';
import { t } from './i18n.ts';

let compact = false;

const results = 'ytd-search #primary:has(> [data-fovilo-search][data-fovilo-density="compact"]) ' +
  'ytd-item-section-renderer > #contents > ytd-video-renderer';

export function mountSearch(anchor: Element) {
  const { host, toggle, actions, status, signal, current, dispose, addCommands } = createBrowseRail('search', anchor);
  const styles = document.createElement('style');
  styles.textContent = `
    ${results} { margin-block-start: 8px; }
    @media (min-width: 1000px) {
      ${results} #dismissible > ytd-thumbnail { max-inline-size: 360px; }
    }
  `;
  host.append(styles);
  const density = document.createElement('button');
  density.textContent = t('compactResults');
  actions.append(density);

  function showDensity() {
    host.dataset.foviloDensity = compact ? 'compact' : 'comfortable';
    density.setAttribute('aria-pressed', String(compact));
    toggle.textContent = t(compact ? 'searchCompactControls' : 'searchControls');
  }
  showDensity();

  function toggleDensity() {
    if (!current()) return;
    compact = !compact;
    showDensity();
    status.textContent = t(compact ? 'compactEnabled' : 'standardSearchRestored');
  }
  density.addEventListener('click', (event) => {
    if (event.isTrusted) toggleDensity();
  }, { signal });
  const openCommands = addCommands([{ id: 'search.toggle-compact', label: t('toggleCompactResults'), run: toggleDensity }]);

  anchor.prepend(host);
  return { anchor, host, openCommands, dispose };
}
