export type Command = {
  label: string;
  run: () => void;
  available?: () => boolean;
};

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
    dialog li[hidden] { display: none; }
    dialog li button { inline-size: 100%; text-align: start; }
    dialog p { margin-block-end: 0; }
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
    results.append(row);
    return { command, row, button };
  });

  function filter() {
    const words = search.value.trim().toLowerCase().split(/\s+/);
    for (const { command, row } of rows) {
      row.hidden = command.available?.() === false ||
        !words.every((word) => command.label.toLowerCase().includes(word));
    }
    empty.textContent = rows.every(({ row }) => row.hidden) ? 'No matching commands.' : '';
  }

  function open(fromShortcut = false) {
    if (signal.aborted || !dialog.isConnected || dialog.open) return;
    const previous = document.activeElement === shadow.host ? shadow.activeElement : document.activeElement;
    returnFocus = fromShortcut && previous instanceof HTMLElement && previous !== document.body ? previous : trigger;
    search.value = '';
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
    const visible = rows.filter(({ row }) => !row.hidden);
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
  dialog.append(heading, label, results, empty);
  shadow.append(styles, dialog);
  return { trigger, open };
}
