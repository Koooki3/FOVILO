import { observeSettings, writeSetting } from './settings.ts';
import { timeLink, watchId } from './watch.ts';
import { cinemaStageSelector, recommendationsSelector, watchStyles } from './watch-style.ts';
import { createRail } from './rail.ts';
import { mountSearch } from './search.ts';
import { mountHome } from './home.ts';
import { browseRootSelector } from './browse-rail.ts';
import { createCommands } from './commands.ts';

const ownedSelector = '[data-fovilo-watch], [data-fovilo-search], [data-fovilo-home]';
const navigation = (window as Window & { navigation?: EventTarget }).navigation;
type Route = { kind: 'watch'; id: string; modesAvailable: boolean } | { kind: 'search' | 'home' };
type Surface = { anchor: Element; host: HTMLElement; dispose: () => void };
type Mounted = Surface & { key: string };
let mounted: Mounted | undefined;
let enabled = false;
let watchEnabled = false;
let searchEnabled = false;
let homeEnabled = false;
let failed = false;
let pending = false;
let retry: number | undefined;
let observedRoot: Element | undefined;
let railExpanded = true;
let lastMedia: { id: string; element: HTMLVideoElement; src: string } | undefined;

const anchorObserver = new MutationObserver(() => {
  if (observedRoot && (!observedRoot.isConnected || !mounted || !mounted.anchor.isConnected ||
      mounted.host.parentElement !== mounted.anchor)) {
    schedule();
  }
});

const discoveryObserver = new MutationObserver(() => {
  const route = currentRoute();
  if (route && routeRoot(route)) schedule();
});

function observeRoot(root: Element | undefined) {
  if (root === observedRoot) return;
  anchorObserver.disconnect();
  observedRoot = root;
  if (root) {
    anchorObserver.observe(root, { childList: true, subtree: true });
    if (root.parentElement) anchorObserver.observe(root.parentElement, { childList: true });
  }
}

function clearRetry() {
  discoveryObserver.disconnect();
  window.clearTimeout(retry);
  retry = undefined;
}

function dispose() {
  mounted?.dispose();
  mounted = undefined;
}

function unique<T extends Element>(root: ParentNode, selector: string): T | undefined {
  const matches = root.querySelectorAll<T>(selector);
  return matches.length === 1 ? matches[0] : undefined;
}

function watchRoot(id: string) {
  return unique(document, 'ytd-watch-flexy:not([hidden])[video-id="' + id + '"]');
}

function currentRoute(): Route | undefined {
  if (!enabled || failed) return;
  const url = new URL(location.href);
  const id = watchEnabled ? watchId(url) : null;
  if (id) return { kind: 'watch', id, modesAvailable: !url.searchParams.has('list') };
  if (url.origin !== 'https://www.youtube.com') return;
  if (searchEnabled && url.pathname === '/results') return { kind: 'search' };
  if (homeEnabled && url.pathname === '/') return { kind: 'home' };
}

function routeRoot(route: Route) {
  return route.kind === 'watch' ? watchRoot(route.id) : unique(document, browseRootSelector(route.kind));
}

function currentMedia(root: Element, id: string) {
  const element = unique<HTMLVideoElement>(root, '#movie_player video.html5-main-video');
  if (!element || !element.currentSrc || element.readyState === 0) return;
  if (lastMedia && lastMedia.id !== id &&
      lastMedia.element === element && lastMedia.src === element.currentSrc) return;
  lastMedia = { id, element, src: element.currentSrc };
  return element;
}

function mountWatch(id: string, anchor: Element, modesAvailable: boolean): Surface {
  const scope = new AbortController();
  const { signal } = scope;
  const { host, shadow, panel, toggle, actions, restore, status, setExpanded } =
    createRail('watch', railExpanded, signal);
  host.toggleAttribute('data-fovilo-modes-available', modesAvailable);
  const pageStyles = document.createElement('style');
  pageStyles.textContent = watchStyles;
  host.append(pageStyles);
  const time = document.createElement('button');
  time.textContent = 'Copy time link';
  const modes = [
    { name: 'focus', label: 'Focus', selector: recommendationsSelector, feedback: 'Recommendations hidden.' },
    { name: 'cinema', label: 'Cinema', selector: cinemaStageSelector + ':has(#movie_player)', feedback: 'Cinema enabled.' },
  ].map((mode) => {
    const button = document.createElement('button');
    button.textContent = mode.label;
    button.dataset.watchMode = mode.name;
    button.setAttribute('aria-pressed', 'false');
    return { ...mode, button };
  });
  let returning = false;
  const link = document.createElement('input');
  link.readOnly = true;
  link.hidden = true;
  link.setAttribute('aria-label', 'Time link for manual copying');

  function current() {
    const url = new URL(location.href);
    return !signal.aborted && host.isConnected && watchId(url) === id &&
      modesAvailable === !url.searchParams.has('list') &&
      watchRoot(id)?.contains(anchor);
  }

  function toggleRail() {
    if (!current()) return;
    railExpanded = !railExpanded;
    setExpanded(railExpanded);
    if (!railExpanded) link.hidden = true;
  }

  type Mode = typeof modes[number];
  function supportsMode(mode: Mode) {
    if (!modesAvailable || !current()) return false;
    const root = watchRoot(id);
    return Boolean(root && !root.hasAttribute('is-live') && unique(root, mode.selector));
  }

  function toggleMode(mode: Mode) {
    if (!supportsMode(mode)) return;
    const next = host.dataset.foviloMode === mode.name ? 'everyday' : mode.name;
    host.dataset.foviloMode = next;
    for (const control of modes) control.button.setAttribute('aria-pressed', String(control.name === next));
    toggle.textContent = next === 'everyday' ? 'Watch controls' : 'Watch controls · ' + mode.label;
    status.textContent = next === 'everyday' ? 'Everyday restored.' : mode.feedback;
  }

  async function copyTimeLink() {
    if (time.hasAttribute('aria-disabled') || !current()) return;
    link.hidden = true;
    const root = watchRoot(id);
    const media = root && currentMedia(root, id);
    const player = media?.closest('#movie_player');
    if (!media || !Number.isFinite(media.duration) ||
      !Number.isFinite(media.currentTime) || media.currentTime < 0 ||
      player?.matches('.ad-showing, .ad-interrupting')) {
      status.textContent = 'The video timestamp is unavailable.';
      return;
    }
    const url = timeLink(id, media.currentTime);
    time.setAttribute('aria-disabled', 'true');
    try {
      await navigator.clipboard.writeText(url);
      if (current() && railExpanded) status.textContent = 'Time link copied.';
    } catch {
      if (!current() || !railExpanded) return;
      link.value = url;
      link.hidden = false;
      status.textContent = 'Clipboard unavailable. Copy the link manually.';
      if (shadow.activeElement === time) {
        link.focus();
        link.select();
      }
    } finally {
      time.removeAttribute('aria-disabled');
    }
  }

  async function restoreYouTube() {
    if (returning || !current()) return;
    returning = true;
    restore.setAttribute('aria-disabled', 'true');
    try {
      await writeSetting('enabled', false);
    } catch {
      returning = false;
      restore.removeAttribute('aria-disabled');
      if (current()) status.textContent = 'Could not save the setting. Try again.';
    }
  }

  function onClick(button: HTMLButtonElement, run: () => void) {
    button.addEventListener('click', (event) => {
      if (event.isTrusted) run();
    }, { signal });
  }
  onClick(toggle, toggleRail);
  onClick(time, copyTimeLink);
  onClick(restore, restoreYouTube);
  for (const mode of modes) onClick(mode.button, () => toggleMode(mode));

  const commands = createCommands(shadow, [
    {
      label: 'Copy time link',
      run() {
        if (!railExpanded) toggleRail();
        time.focus({ preventScroll: true });
        void copyTimeLink();
      },
    },
    ...modes.map((mode) => ({
      label: 'Toggle ' + mode.label,
      run: () => toggleMode(mode),
      available: () => supportsMode(mode),
    })),
    { label: 'Toggle Watch controls', run: toggleRail },
    { label: 'Return to YouTube', run: restoreYouTube },
  ], signal);
  restore.before(commands);

  actions.append(time, ...modes.map((mode) => mode.button));
  panel.append(link);
  anchor.append(host);
  return {
    anchor,
    host,
    dispose() {
      if (returning && document.activeElement === host && current()) {
        const target = anchor.querySelector('h1') ?? anchor;
        if (target instanceof HTMLElement) {
          const hadTabIndex = target.hasAttribute('tabindex');
          if (!hadTabIndex) target.tabIndex = -1;
          target.focus({ preventScroll: true });
          if (!hadTabIndex) {
            const cleanup = () => {
              if (target.getAttribute('tabindex') === '-1') target.removeAttribute('tabindex');
            };
            if (document.activeElement === target) target.addEventListener('blur', cleanup, { once: true });
            else cleanup();
          }
        }
      }
      scope.abort();
      host.remove();
    },
  };
}

function reconcile(allowRetry: boolean) {
  const route = currentRoute();
  if (!route) {
    observeRoot(undefined);
    dispose();
    return;
  }

  const root = routeRoot(route);
  observeRoot(root);
  if (root && route.kind === 'watch') currentMedia(root, route.id);
  const anchor = root && unique(root, route.kind === 'watch' ? '#above-the-fold' : '#primary');
  const key = route.kind === 'watch' ? route.id + ':' + route.modesAvailable : route.kind;
  if (mounted && (mounted.key !== key || mounted.anchor !== anchor ||
      mounted.host.parentElement !== anchor)) dispose();
  if (!anchor) {
    if (!root && allowRetry) {
      const container = document.querySelector('ytd-page-manager') ?? document.body;
      discoveryObserver.observe(container, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['video-id', 'hidden', 'page-subtype'],
      });
      retry = window.setTimeout(() => {
        clearRetry();
        reconcile(false);
      }, 2500);
    }
    return;
  }
  if (mounted || anchor.querySelector(ownedSelector)) return;
  try {
    const surface = route.kind === 'watch'
      ? mountWatch(route.id, anchor, route.modesAvailable)
      : route.kind === 'search' ? mountSearch(anchor) : mountHome(anchor);
    mounted = { key, ...surface };
  } catch {
    failed = true;
    observeRoot(undefined);
    dispose();
  }
}

function schedule() {
  if (!enabled || failed || pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    clearRetry();
    reconcile(true);
  });
}

const routeEvents = ['yt-navigate-finish', 'popstate', 'pageshow'];
function updateRoutes(on: boolean) {
  for (const name of routeEvents) {
    if (on) window.addEventListener(name, schedule, true);
    else window.removeEventListener(name, schedule, true);
  }
  if (on) navigation?.addEventListener('currententrychange', schedule);
  else navigation?.removeEventListener('currententrychange', schedule);
}

observeSettings((settings) => {
  watchEnabled = settings?.watchEnabled === true;
  searchEnabled = settings?.searchEnabled === true;
  homeEnabled = settings?.homeEnabled === true;
  const next = settings?.enabled === true && (watchEnabled || searchEnabled || homeEnabled);
  if (next !== enabled) {
    enabled = next;
    updateRoutes(enabled);
  }
  if (enabled) schedule();
  else {
    clearRetry();
    observeRoot(undefined);
    dispose();
  }
});

window.addEventListener('pagehide', () => {
  clearRetry();
  observeRoot(undefined);
  dispose();
});
