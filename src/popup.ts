import { observeSettings, writeSetting, type Setting } from './settings.ts';

declare const chrome: {
  tabs: { create(options: { url: string }): Promise<unknown> };
};

const controls = {
  enabled: document.querySelector<HTMLInputElement>('#enabled')!,
  watchEnabled: document.querySelector<HTMLInputElement>('#watchEnabled')!,
  searchEnabled: document.querySelector<HTMLInputElement>('#searchEnabled')!,
  homeEnabled: document.querySelector<HTMLInputElement>('#homeEnabled')!,
};
const status = document.querySelector<HTMLElement>('[role=status]')!;
document.querySelector<HTMLButtonElement>('#keyboard-shortcuts')!.addEventListener('click', async () => {
  try {
    const scheme = navigator.userAgent.includes('Edg/') ? 'edge' : 'chrome';
    await chrome.tabs.create({ url: scheme + '://extensions/shortcuts' });
  } catch {
    status.textContent = 'Open Keyboard shortcuts from the browser extensions page.';
  }
});
const stop = observeSettings((settings) => {
  if (!settings) {
    status.textContent = 'Settings are unavailable.';
    return;
  }
  for (const key of Object.keys(controls) as Setting[]) {
    controls[key].checked = settings[key];
    controls[key].disabled = false;
  }
});
window.addEventListener('pagehide', stop, { once: true });

for (const key of Object.keys(controls) as Setting[]) {
  const input = controls[key];
  input.addEventListener('change', async () => {
    const requested = input.checked;
    input.disabled = true;
    status.textContent = '';
    try {
      await writeSetting(key, requested);
    } catch {
      input.checked = !requested;
      status.textContent = 'Could not save the setting.';
    } finally {
      input.disabled = false;
    }
  });
}
