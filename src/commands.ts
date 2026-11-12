export type Command = {
  id: string;
  label: string;
  run: () => void;
  available?: () => boolean;
  remember?: false;
};

const recentIds: string[] = [];

function remember(id: string) {
  const oldIndex = recentIds.indexOf(id);
  if (oldIndex !== -1) recentIds.splice(oldIndex, 1);
  recentIds.unshift(id);
  if (recentIds.length > 6) recentIds.pop();
}

export function createCommands(shadow: ShadowRoot, commands: Command[], signal: AbortSignal) {
  const styles = document.createElement('style');
  styles.textContent = `
    dialog {
      box-sizing: border-box; inline-size: min(32rem, calc(100% - 2rem));
      max-block-size: 75vh; overflow: auto; padding: 16px;
      border: 1px solid GrayText; border-radius: 12px;
      background: Canvas; color: CanvasText; font: 14px system-ui;
    }
    dialog::backdrop { background: rgb(0 0 0 / 36%); }
    .command-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .command-heading h2 { margin: 0; font-size: 1.2em; }
    dialog label { display: grid; gap: 6px; margin-block: 12px; }
    dialog ul { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
    dialog [hidden] { display: none; }
    dialog li button { inline-size: 100%; text-align: start; }
    dialog p { margin-block-end: 0; }
    .recent-commands { margin-block-end: 12px; }
    .recent-commands h3 { margin: 0 0 6px; font-size: 0.92em; }
  `;
  const trigger = document.createElement('button');
  trigger.textContent = 'Commands';
  trigger.setAttribute('aria-haspopup', 'dialog');
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'fovilo-commands-title');
  const heading = document.createElement('div');
  heading.className = 'command-heading';
  const title = document.createElement('h2');
  title.id = 'fovilo-commands-title';
  title.textContent = 'Commands';
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  heading.append(title, closeButton);
  const label = document.createElement('label');
  label.textContent = 'Find a command';
  const search = document.createElement('input');
  search.type = 'search';
  label.append(search);
  const recent = document.createElement('div');
  recent.className = 'recent-commands';
  const recentHeading = document.createElement('h3');
  recentHeading.id = 'fovilo-recent-commands';
  recentHeading.textContent = 'Recent commands';
  const recentResults = document.createElement('ul');
  recentResults.setAttribute('aria-labelledby', recentHeading.id);
  recent.append(recentHeading, recentResults);
  const results = document.createElement('ul');
  const empty = document.createElement('p');
  empty.setAttribute('role', 'status');
  let returnFocus: HTMLElement = trigger;

  function close() {
    if (!dialog.open) return;
    dialog.close();
    const target = returnFocus.isConnected ? returnFocus : trigger;
    if (target.isConnected) target.focus({ preventScroll: true });
  }

  function execute(command: Command) {
    if (!dialog.open || command.available?.() === false) return;
    if (command.remember !== false) remember(command.id);
    close();
    command.run();
  }

  const rows = commands.map((command) => {
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = command.label;
    button.addEventListener('click', (event) => {
      if (event.isTrusted) execute(command);
    }, { signal });
    row.append(button);
    return { command, row, button };
  });
  const rowsById = new Map(rows.map((entry) => [entry.command.id, entry]));
  let orderedRows = rows;

  function filter() {
    const words = search.value.trim().toLowerCase().split(/\s+/);
    for (const { command, row } of orderedRows) {
      row.hidden = command.available?.() === false ||
        !words.every((word) => command.label.toLowerCase().includes(word));
    }
    recent.hidden = !recentResults.querySelector('li:not([hidden])');
    results.hidden = !results.querySelector('li:not([hidden])');
    empty.textContent = recent.hidden && results.hidden ? 'No matching commands.' : '';
  }

  function open(fromShortcut = false) {
    if (signal.aborted || !dialog.isConnected || dialog.open) return;
    const previous = document.activeElement === shadow.host ? shadow.activeElement : document.activeElement;
    returnFocus = fromShortcut && previous instanceof HTMLElement && previous !== document.body ? previous : trigger;
    search.value = '';
    const recentRows = recentIds.flatMap((id) => rowsById.get(id) ?? []);
    const otherRows = rows.filter(({ command }) => !recentIds.includes(command.id));
    recentResults.replaceChildren(...recentRows.map(({ row }) => row));
    results.replaceChildren(...otherRows.map(({ row }) => row));
    orderedRows = [...recentRows, ...otherRows];
    filter();
    dialog.showModal();
    search.focus();
  }
  trigger.addEventListener('click', (event) => {
    if (event.isTrusted) open();
  }, { signal });
  closeButton.addEventListener('click', close, { signal });
  search.addEventListener('input', filter, { signal });
  dialog.addEventListener('keyup', (event) => event.stopPropagation(), { signal });
  dialog.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (!event.isTrusted) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    const visible = orderedRows.filter(({ row }) => !row.hidden);
    if (!visible.length) return;
    if (event.key === 'Enter' && event.target === search) {
      event.preventDefault();
      execute(visible[0].command);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const index = visible.findIndex(({ button }) => button === event.target);
      if (index < 0 && event.target !== search) return;
      event.preventDefault();
      const next = event.key === 'ArrowDown'
        ? (index + 1) % visible.length
        : (index < 0 ? visible.length - 1 : (index + visible.length - 1) % visible.length);
      visible[next].button.focus();
    }
  }, { signal });
  signal.addEventListener('abort', () => {
    if (dialog.open) dialog.close();
  }, { once: true });
  dialog.append(heading, label, recent, results, empty);
  shadow.append(styles, dialog);
  return { trigger, open };
}
