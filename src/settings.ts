type StorageChanges = Record<string, { newValue?: unknown }>;

declare const chrome: {
  storage: {
    local: {
      get(keys: string[]): Promise<Record<string, unknown>>;
      set(values: Record<string, boolean>): Promise<void>;
    };
    onChanged: {
      addListener(listener: (changes: StorageChanges, area: string) => void): void;
      removeListener(listener: (changes: StorageChanges, area: string) => void): void;
    };
  };
};

const keys = ['enabled', 'watchEnabled', 'searchEnabled', 'homeEnabled'] as const;
export type Setting = typeof keys[number];
type Settings = Record<Setting, boolean>;

export function writeSetting(key: Setting, value: boolean) {
  return chrome.storage.local.set({ [key]: value });
}

export function observeSettings(onUpdate: (value: Settings | null) => void) {
  const values: Settings = { enabled: true, watchEnabled: true, searchEnabled: true, homeEnabled: true };
  const changed = new Set<Setting>();
  let ready = false;
  let active = true;

  const listener = (changes: StorageChanges, area: string) => {
    if (area !== 'local') return;
    for (const key of keys) {
      if (!Object.hasOwn(changes, key)) continue;
      changed.add(key);
      values[key] = changes[key].newValue === undefined || changes[key].newValue === true;
    }
    if (ready) onUpdate({ ...values });
  };
  chrome.storage.onChanged.addListener(listener);
  void chrome.storage.local.get([...keys]).then((snapshot) => {
    if (!active) return;
    for (const key of keys) {
      if (changed.has(key)) continue;
      values[key] = snapshot[key] === undefined || snapshot[key] === true;
    }
    ready = true;
    onUpdate({ ...values });
  }, () => {
    if (active) onUpdate(null);
  });

  return () => {
    active = false;
    chrome.storage.onChanged.removeListener(listener);
  };
}
