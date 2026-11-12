import { createBrowseRail } from './browse-rail.ts';

export function mountHome(anchor: Element) {
  const { host, actions, current, dispose, addCommands } = createBrowseRail('home', anchor);
  const subscriptions = document.createElement('a');
  subscriptions.href = '/feed/subscriptions';
  subscriptions.textContent = 'Subscriptions';
  actions.append(subscriptions);
  const openCommands = addCommands([{ label: 'Open Subscriptions', run() {
    if (current()) location.assign(subscriptions.href);
  } }]);
  anchor.prepend(host);
  return { anchor, host, openCommands, dispose };
}
