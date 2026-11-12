export const commandShortcut = 'open-commands';
export const openCommandsMessage = { type: 'fovilo.open-commands' } as const;

declare const chrome: {
  runtime: {
    id: string;
    onMessage: {
      addListener(listener: (message: unknown, sender: { id?: string; tab?: unknown }) => void): void;
    };
  };
};

export function onShortcut(open: () => void) {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id || sender.tab || !message || typeof message !== 'object') return;
    if (!('type' in message) || message.type !== openCommandsMessage.type) return;
    if (document.visibilityState !== 'visible' || !document.hasFocus() ||
        document.fullscreenElement || document.querySelector('dialog:modal')) return;
    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    if (focused?.matches('input, textarea, select, iframe, [role="textbox"], [role="combobox"]') ||
        (focused instanceof HTMLElement && focused.isContentEditable)) return;
    open();
  });
}
