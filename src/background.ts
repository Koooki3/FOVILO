import { commandShortcut, openCommandsMessage } from './shortcut.ts';

type Tab = { id?: number };
declare const chrome: {
  commands: {
    onCommand: { addListener(listener: (command: string, tab?: Tab) => void): void };
  };
  tabs: {
    query(query: { active: boolean; lastFocusedWindow: boolean }): Promise<Tab[]>;
    sendMessage(tabId: number, message: unknown, options: { frameId: number }): Promise<unknown>;
  };
};

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== commandShortcut) return;
  void openInTab(tab);
});

async function openInTab(tab: Tab | undefined) {
  try {
    const target = tab ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    if (target?.id === undefined) return;
    await chrome.tabs.sendMessage(target.id, openCommandsMessage, { frameId: 0 });
  } catch {
    // No content script is expected on unsupported or closed tabs.
  }
}
