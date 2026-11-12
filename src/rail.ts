type Surface = 'watch' | 'search';

export function createRail(surface: Surface, expanded: boolean, signal: AbortSignal) {
  const name = surface === 'watch' ? 'Watch' : 'Search';
  const host = document.createElement('div');
  host.setAttribute('data-fovilo-' + surface, '');
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
    .rail-heading, .rail-actions {
      display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
      min-inline-size: 0; max-inline-size: 100%;
    }
    .rail-heading { margin-inline-end: auto; }
    .rail-actions[hidden] { display: none; }
    [aria-expanded]::after {
      content: ''; display: inline-block; inline-size: 5px; block-size: 5px;
      margin-inline-start: 8px; vertical-align: 0.17em;
      border-inline-end: 1px solid currentColor; border-block-end: 1px solid currentColor;
      transform: rotate(45deg);
    }
    [aria-expanded=true]::after { transform: rotate(225deg); }
    [data-watch-mode=focus] { display: var(--fovilo-focus-display, none); }
    [data-watch-mode=cinema] { display: var(--fovilo-cinema-display, none); }
    button[aria-pressed=true] {
      background: Highlight; color: HighlightText; border-color: Highlight;
    }
    [role=status] { flex-basis: 100%; }
    [role=status]:empty {
      position: absolute; inline-size: 1px; block-size: 1px;
      overflow: hidden; clip-path: inset(50%);
    }
  `;
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'FOVILO ' + name + ' controls');
  const heading = document.createElement('div');
  heading.className = 'rail-heading';
  const label = document.createElement('strong');
  label.textContent = 'FOVILO';
  const toggle = document.createElement('button');
  toggle.textContent = name + ' controls';
  const actions = document.createElement('div');
  actions.className = 'rail-actions';
  actions.id = 'fovilo-' + surface + '-actions';
  toggle.setAttribute('aria-controls', actions.id);
  const restore = document.createElement('button');
  restore.textContent = 'Return to YouTube';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');

  function setExpanded(open: boolean) {
    toggle.setAttribute('aria-expanded', String(open));
    actions.hidden = !open;
    if (!open) status.textContent = '';
  }

  function keepButtonActivation(event: KeyboardEvent) {
    if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) {
      event.stopPropagation();
    }
  }
  panel.addEventListener('keydown', keepButtonActivation, { signal });
  panel.addEventListener('keyup', keepButtonActivation, { signal });
  heading.append(label, toggle);
  panel.append(heading, actions, restore, status);
  shadow.append(styles, panel);
  setExpanded(expanded);
  return { host, shadow, panel, toggle, actions, restore, status, setExpanded };
}
