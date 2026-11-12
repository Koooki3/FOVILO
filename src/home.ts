import { createBrowseRail } from './browse-rail.ts';
import { t } from './i18n.ts';

export function mountHome(anchor: Element) {
  const { host, actions, current, dispose, addCommands } = createBrowseRail('home', anchor);
  const subscriptions = document.createElement('a');
  subscriptions.href = '/feed/subscriptions';
  subscriptions.textContent = t('subscriptions');
  actions.append(subscriptions);
  const openCommands = addCommands([{ id: 'home.open-subscriptions', label: t('openSubscriptions'), run() {
    if (current()) location.assign(subscriptions.href);
  } }]);
  anchor.prepend(host);
  return { anchor, host, openCommands, dispose };
}
