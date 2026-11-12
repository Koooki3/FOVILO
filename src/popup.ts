import { observeSettings, writeSetting, type Setting } from './settings.ts';
import { language, t } from './i18n.ts';

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
const shortcuts = document.querySelector<HTMLButtonElement>('#keyboard-shortcuts')!;
document.documentElement.lang = language;
document.querySelector('#enabled-label')!.textContent = t('enableFovilo');
document.querySelector('#watch-label')!.textContent = t('watchControls');
document.querySelector('#search-label')!.textContent = t('searchControls');
document.querySelector('#home-label')!.textContent = t('homeControls');
shortcuts.textContent = t('keyboardShortcuts');
shortcuts.addEventListener('click', async () => {
  try {
    const scheme = navigator.userAgent.includes('Edg/') ? 'edge' : 'chrome';
    await chrome.tabs.create({ url: scheme + '://extensions/shortcuts' });
  } catch {
    status.textContent = t('shortcutHelp');
  }
});
const stop = observeSettings((settings) => {
  if (!settings) {
    status.textContent = t('settingsUnavailable');
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
      status.textContent = t('settingsError');
    } finally {
      input.disabled = false;
    }
  });
}
