import { observeSettings, writeSetting } from './settings.ts';
import { timeLink, watchId } from './watch.ts';

const ownedSelector = '[data-fovilo-watch]';
const navigation = (window as Window & { navigation?: EventTarget }).navigation;
type Mounted = { id: string; anchor: Element; host: HTMLElement; dispose: () => void };
let mounted: Mounted | undefined;
let enabled = false;
let failed = false;
let pending = false;
let retry: number | undefined;
let observedRoot: Element | undefined;
let lastMedia: { id: string; element: HTMLVideoElement; src: string } | undefined;

const anchorObserver = new MutationObserver(() => {
  if (observedRoot && (!observedRoot.isConnected || !mounted || !mounted.anchor.isConnected ||
      mounted.host.parentElement !== mounted.anchor)) {
    schedule();
  }
});

const discoveryObserver = new MutationObserver(() => {
  const id = watchId(new URL(location.href));
  if (id && watchRoot(id)) schedule();
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

function currentMedia(root: Element, id: string) {
  const element = unique<HTMLVideoElement>(root, '#movie_player video.html5-main-video');
  if (!element || !element.currentSrc || element.readyState === 0) return;
  if (lastMedia && lastMedia.id !== id &&
      lastMedia.element === element && lastMedia.src === element.currentSrc) return;
  lastMedia = { id, element, src: element.currentSrc };
  return element;
}

function mount(id: string, anchor: Element): Mounted {
  const scope = new AbortController();
  const { signal } = scope;
  const host = document.createElement('div');
  host.dataset.foviloWatch = '';
  const shadow = host.attachShadow({ mode: 'open' });
  const styles = document.createElement('style');
  styles.textContent = `
    :host { display: block; margin-block: 12px; color-scheme: light dark; }
    section { display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
      padding: 10px; border: 1px solid GrayText; border-radius: 12px;
      background: Canvas; color: CanvasText; font: 14px system-ui; }
    button, input { font: inherit; color: CanvasText; background: Canvas;
      border: 1px solid GrayText; border-radius: 8px; padding: 8px; }
    input { box-sizing: border-box; max-inline-size: 100%; }
    button:focus-visible, input:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
    strong { margin-inline-end: auto; }
    [role=status]:empty { display: none; }
  `;
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'FOVILO Watch controls');
  const label = document.createElement('strong');
  label.textContent = 'FOVILO';
  const time = document.createElement('button');
  time.textContent = 'Copy time link';
  const restore = document.createElement('button');
  restore.textContent = 'Return to YouTube';
  let returning = false;
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  const link = document.createElement('input');
  link.readOnly = true;
  link.hidden = true;
  link.setAttribute('aria-label', 'Time link for manual copying');

  function current() {
    return !signal.aborted && host.isConnected && watchId(new URL(location.href)) === id &&
      watchRoot(id)?.contains(anchor);
  }

  time.addEventListener('click', async (event) => {
    if (!event.isTrusted || time.hasAttribute('aria-disabled') || !current()) return;
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
      if (current()) status.textContent = 'Time link copied.';
    } catch {
      if (!current()) return;
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
  }, { signal });

  restore.addEventListener('click', async (event) => {
    if (!event.isTrusted || returning || !current()) return;
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

  panel.append(label, time, restore, status, link);
  shadow.append(styles, panel);
  anchor.append(host);
  return {
    id,
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
  const id = enabled && !failed ? watchId(new URL(location.href)) : null;
  if (!id) {
    observeRoot(undefined);
    dispose();
    return;
  }

  const root = watchRoot(id);
  observeRoot(root);
  if (root) currentMedia(root, id);
  const anchor = root && unique(root, '#above-the-fold');
  if (mounted && (mounted.id !== id || mounted.anchor !== anchor ||
      mounted.host.parentElement !== anchor)) dispose();
  if (!anchor) {
    if (!root && allowRetry) {
      const container = document.querySelector('ytd-page-manager') ?? document.body;
      discoveryObserver.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['video-id'] });
      retry = window.setTimeout(() => {
        clearRetry();
        reconcile(false);
      }, 2500);
    }
    return;
  }
  if (mounted || anchor.querySelector(ownedSelector)) return;
  try {
    mounted = mount(id, anchor);
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
  const next = settings?.enabled === true && settings.watchEnabled;
  if (next === enabled) return;
  enabled = next;
  updateRoutes(enabled);
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
