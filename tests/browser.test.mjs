import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = 'https://www.youtube.com';
const first = 'abcdefghijk';
const second = 'zyxwvutsrqp';
const watch = (id) => '/watch?v=' + id;
const host = '[data-fovilo-watch]';
const blockedWatch = watch(first) + '&clipboard=blocked';

async function politeStatusNodes(cdp) {
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  return nodes.filter((node) => !node.ignored && node.role?.value === 'status' &&
    node.properties?.some((property) => property.name === 'live' && property.value.value === 'polite'));
}

function audioFixture() {
  const samples = 32_000;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  return 'data:audio/wav;base64,' + wav.toString('base64');
}

test('built MV3 extension mounts, rejects stale routes, and restores native nodes', async () => {
  const work = resolve('work');
  await mkdir(work, { recursive: true });
  const profile = await mkdtemp(join(work, 'chromium-'));
  let context;
  try {
    const dist = resolve('dist');
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      locale: 'en-US',
      args: ['--disable-extensions-except=' + dist, '--load-extension=' + dist],
    });
    await context.route('**/*', (route) => {
      if (route.request().url().startsWith('chrome-extension://')) return route.continue();
      const request = route.request().url();
      if (![origin + '/', origin + '/feed/subscriptions', origin + watch(first), origin + blockedWatch].includes(request)) return route.abort();
      const headers = request === origin + blockedWatch ? { 'Permissions-Policy': 'clipboard-write=()' } : {};
      return route.fulfill({ contentType: 'text/html', headers, body: `
        <!doctype html><title>YouTube fixture</title>
        <style>#title h1 { font-weight: 500; } #channel-name a { font-weight: 400; }
          #info { font-weight: 500; } ytd-video-renderer { display: block; margin-block-start: 16px; }</style>
        <ytd-masthead><input name="search_query" aria-label="Native search"></ytd-masthead>
        <ytd-browse page-subtype="home"><div id="primary">
          <h2>Native empty feed</h2>
        </div></ytd-browse>
        <ytd-watch-flexy video-id="${first}">
          <div id="primary-inner"><div id="player">
            <div id="movie_player"><video class="html5-main-video" controls
              src="${audioFixture()}"></video></div>
          </div></div>
          <div id="above-the-fold">
            <div id="title"><h1>Native title</h1></div>
            <div id="owner"><div id="channel-name"><a href="#native">Native action</a></div></div>
            <div id="description-inner"><div id="info">Views and date</div></div>
          </div>
          <textarea aria-label="Native comment"></textarea>
          <div id="secondary-inner">
            <div id="playlist">Native playlist panel</div>
            <div id="related"><a href="#next">Native recommendation</a></div>
          </div>
        </ytd-watch-flexy>
        <ytd-search><div id="primary">
          <button>Native filters</button>
          <ytd-item-section-renderer><div id="contents"><ytd-video-renderer>
            <a href="${watch(first)}">Native search result</a>
          </ytd-video-renderer></div></ytd-item-section-renderer>
        </div></ytd-search>` });
    });

    const page = context.pages()[0];
    await page.goto(origin + '/');
    assert.equal(await page.locator(host).count(), 0);
    const homeRail = page.locator('[data-fovilo-home]');
    const homeDisclosure = homeRail.getByRole('button', { name: 'Home controls' });
    const subscriptions = homeRail.getByRole('link', { name: 'Subscriptions' });
    await homeRail.waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Native empty feed' }).isVisible(), true);
    await homeDisclosure.focus();
    await page.keyboard.press('Space');
    assert.equal(await homeDisclosure.getAttribute('aria-expanded'), 'false');
    assert.equal(await subscriptions.count(), 0);
    assert.equal(await homeRail.getByRole('button', { name: 'Return to YouTube' }).isVisible(), true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal(await subscriptions.evaluate((link) => link.getRootNode().activeElement === link), true);
    await page.keyboard.press('Enter');
    await page.waitForURL(origin + '/feed/subscriptions');
    assert.equal(await homeRail.count(), 0);
    await page.goBack();
    await homeRail.waitFor();
    const hierarchy = () => page.evaluate(() =>
      ['#title h1', '#channel-name a', '#info'].map((selector) =>
        getComputedStyle(document.querySelector(selector)).fontWeight));
    assert.deepEqual(await hierarchy(), ['500', '400', '500']);
    await page.evaluate((path) => {
      window.nativeVideo = document.querySelector('video');
      window.nativeTitle = document.querySelector('h1');
      history.pushState(null, '', path);
    }, watch(first));
    await page.locator(host).waitFor();
    await homeRail.waitFor({ state: 'detached' });
    assert.deepEqual(await hierarchy(), ['700', '600', '400']);
    const readScheme = () => page.locator(host).evaluate((element) => getComputedStyle(element).colorScheme);
    assert.equal(await readScheme(), 'light');
    await page.evaluate(() => document.documentElement.setAttribute('dark', ''));
    assert.equal(await readScheme(), 'dark');
    await page.evaluate(() => document.documentElement.removeAttribute('dark'));
    assert.equal(await readScheme(), 'light');
    await page.waitForFunction(() => window.nativeVideo.readyState > 0);
    await page.evaluate(() => { window.nativeVideo.currentTime = 2; });
    await page.getByRole('link', { name: 'Native action' }).focus();
    await page.keyboard.press('Tab');
    const rail = page.getByRole('button', { name: /^Watch controls/ });
    assert.equal(await rail.evaluate((button) =>
      button.getRootNode().activeElement === button &&
      button.getRootNode().getElementById(button.getAttribute('aria-controls')) !== null), true);
    assert.equal(await rail.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Space');
    assert.equal(await rail.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.getByRole('button', { name: 'Copy time link' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Return to YouTube' }).isVisible(), true);
    await page.keyboard.press('Enter');
    assert.equal(await rail.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.querySelector('[data-fovilo-watch]').shadowRoot.activeElement?.textContent === 'Copy time link');
    await page.keyboard.press('Space');
    await page.getByText('Time link copied.').waitFor();
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), origin + watch(first) + '&t=2s');
    const commands = page.getByRole('button', { name: 'Commands', exact: true });
    const commandDialog = page.getByRole('dialog', { name: 'Commands' });
    const commandSearch = commandDialog.getByRole('searchbox', { name: 'Find a command' });
    await commands.click();
    assert.equal(await commandSearch.evaluate((input) => input.getRootNode().activeElement === input), true);
    await commandSearch.fill('no matching operation');
    await commandDialog.getByText('No matching commands.').waitFor();
    await page.keyboard.press('Enter');
    assert.equal(await commandDialog.isVisible(), true);
    await page.keyboard.press('Escape');
    await commandDialog.waitFor({ state: 'hidden' });
    assert.equal(await commands.evaluate((button) => button.getRootNode().activeElement === button), true);
    await rail.click();
    await commands.click();
    await commandSearch.fill('copy link');
    await page.keyboard.press('ArrowDown');
    const commandCopy = commandDialog.getByRole('button', { name: 'Copy time link' });
    assert.equal(await commandCopy.evaluate((button) => button.getRootNode().activeElement === button), true);
    await page.keyboard.press('Enter');
    await commandDialog.waitFor({ state: 'hidden' });
    await page.getByText('Time link copied.').waitFor();
    assert.equal(await rail.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), origin + watch(first) + '&t=2s');
    await commands.click();
    const recent = commandDialog.getByRole('list', { name: 'Recent commands' });
    const recentNames = () => recent.getByRole('button').allTextContents();
    assert.deepEqual(await recentNames(), ['Copy time link']);
    await commandSearch.fill('cinema');
    assert.equal(await recent.count(), 0);
    await page.keyboard.press('Enter');
    await page.getByText('Cinema enabled.').waitFor();
    await page.getByRole('button', { name: 'Cinema', exact: true }).click();
    await commands.click();
    assert.deepEqual(await recentNames(), ['Toggle Cinema', 'Copy time link']);
    await commandSearch.fill('copy');
    await page.keyboard.press('ArrowDown');
    assert.equal(await commandCopy.evaluate((button) => button.getRootNode().activeElement === button), true);
    await page.keyboard.press('Enter');
    await page.getByText('Time link copied.').waitFor();
    await commands.click();
    assert.deepEqual(await recentNames(), ['Copy time link', 'Toggle Cinema']);
    assert.equal(await commandDialog.getByRole('button', { name: 'Copy time link' }).count(), 1);
    await page.keyboard.press('Escape');
    await page.locator('#movie_player').evaluate((el) => el.classList.add('ad-showing'));
    await page.evaluate(() => { window.nativeVideo.currentTime = 1; });
    await page.getByRole('button', { name: 'Copy time link' }).click();
    await page.getByText('The video timestamp is unavailable.').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), origin + watch(first) + '&t=2s');
    await page.locator('#movie_player').evaluate((el) => el.classList.remove('ad-showing'));
    await page.evaluate(() => { window.nativeVideo.currentTime = 3; });
    await page.getByRole('button', { name: 'Copy time link' }).click();
    await page.getByText('Time link copied.').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), origin + watch(first) + '&t=3s');
    await page.evaluate(() => { window.nativeVideo.currentTime = 2; });

    const focus = page.getByRole('button', { name: 'Focus', exact: true });
    const cinema = page.getByRole('button', { name: 'Cinema', exact: true });
    const recommendations = page.locator('#secondary-inner > #related');
    const stage = page.locator('#primary-inner > #player');
    const matte = () => stage.evaluate((element) => getComputedStyle(element).boxShadow);
    const nativePlaylist = page.locator('#playlist');
    await focus.focus();
    await page.keyboard.press('Space');
    await recommendations.waitFor({ state: 'hidden' });
    assert.equal(await focus.getAttribute('aria-pressed'), 'true');
    assert.equal(await nativePlaylist.isVisible(), true);
    assert.equal(await page.evaluate(() =>
      document.querySelector('video') === window.nativeVideo && window.nativeVideo.currentTime === 2), true);
    await page.keyboard.press('Space');
    await recommendations.waitFor();
    assert.equal(await focus.getAttribute('aria-pressed'), 'false');
    await focus.click();
    await recommendations.waitFor({ state: 'hidden' });
    const originalStage = await stage.boundingBox();
    assert.equal(await matte(), 'none');
    await cinema.click();
    assert.equal(await focus.getAttribute('aria-pressed'), 'false');
    assert.equal(await cinema.getAttribute('aria-pressed'), 'true');
    assert.notEqual(await matte(), 'none');
    assert.deepEqual(await stage.boundingBox(), originalStage);
    assert.equal(await nativePlaylist.isVisible(), true);
    await page.locator('ytd-watch-flexy').evaluate((root) => root.setAttribute('theater', ''));
    assert.equal(await matte(), 'none');
    await page.locator('ytd-watch-flexy').evaluate((root) => root.removeAttribute('theater'));
    assert.notEqual(await matte(), 'none');
    await cinema.click();
    await recommendations.waitFor();
    assert.equal(await matte(), 'none');
    await cinema.click();

    await page.evaluate((path) => history.pushState(null, '', path), watch(first) + '&list=fixture');
    await recommendations.waitFor();
    assert.equal(await focus.count(), 0);
    assert.equal(await cinema.count(), 0);
    assert.equal(await matte(), 'none');
    await commands.click();
    assert.deepEqual(await recentNames(), ['Copy time link']);
    assert.equal(await commandDialog.getByRole('button', { name: 'Toggle Cinema' }).count(), 0);
    await commandSearch.fill('focus');
    await commandDialog.getByText('No matching commands.').waitFor();
    await page.keyboard.press('Escape');
    await page.evaluate(() => history.back());
    await focus.waitFor();
    assert.equal(await focus.getAttribute('aria-pressed'), 'false');
    assert.equal(await cinema.getAttribute('aria-pressed'), 'false');
    await cinema.click();
    await recommendations.waitFor({ state: 'hidden' });
    await rail.click();
    assert.equal(await rail.getAttribute('aria-expanded'), 'false');
    assert.equal(await rail.innerText(), 'Watch controls · Cinema');
    await commands.click();
    await commandDialog.waitFor();

    await page.evaluate((path) => history.pushState(null, '', path), watch(second));
    await page.locator(host).waitFor({ state: 'detached' });
    assert.equal(await commandDialog.count(), 0);
    await recommendations.waitFor();
    assert.equal(await matte(), 'none');
    await page.evaluate((id) => {
      document.querySelector('ytd-watch-flexy').setAttribute('video-id', id);
      for (let index = 0; index < 20; index += 1) {
        document.dispatchEvent(new Event('yt-navigate-finish', { bubbles: true }));
      }
    }, second);
    await page.locator(host).waitFor();
    assert.equal(await page.locator(host).count(), 1);
    assert.equal(await rail.getAttribute('aria-expanded'), 'false');
    assert.equal(await rail.innerText(), 'Watch controls');
    assert.equal(await page.getByRole('button', { name: 'Copy time link' }).count(), 0);
    await rail.click();
    assert.equal(await focus.getAttribute('aria-pressed'), 'false');
    await page.getByRole('button', { name: 'Copy time link' }).click();
    await page.getByText('The video timestamp is unavailable.').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), origin + watch(first) + '&t=3s');
    await page.evaluate(() => history.back());
    await page.locator(host).waitFor({ state: 'detached' });
    await page.evaluate((id) => {
      document.querySelector('ytd-watch-flexy').setAttribute('video-id', id);
      document.dispatchEvent(new Event('yt-navigate-finish', { bubbles: true }));
    }, first);
    await page.locator(host).waitFor();
    await page.locator('#above-the-fold').evaluate((anchor) => {
      const next = document.createElement('div');
      next.id = anchor.id;
      next.append(window.nativeTitle);
      anchor.replaceWith(next);
    });
    await page.locator(host).waitFor();
    assert.equal(await page.locator(host).count(), 1);

    await page.evaluate(() => {
      const previous = document.querySelector('ytd-watch-flexy');
      const next = document.createElement('ytd-watch-flexy');
      next.setAttribute('video-id', previous.getAttribute('video-id'));
      next.append(...previous.children);
      previous.replaceWith(next);
      next.querySelector('[data-fovilo-watch]').remove();
    });
    await page.locator(host).waitFor();
    assert.equal(await page.locator(host).count(), 1);

    await page.getByRole('textbox', { name: 'Native comment' }).fill('Keep this draft');
    await cinema.click();
    await recommendations.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Return to YouTube' }).click();
    await page.locator(host).waitFor({ state: 'detached' });
    await recommendations.waitFor();
    assert.equal(await matte(), 'none');
    assert.deepEqual(await page.evaluate(() => ({
      video: document.querySelector('video') === window.nativeVideo,
      title: document.querySelector('h1') === window.nativeTitle,
      time: window.nativeVideo.currentTime,
      comment: document.querySelector('textarea').value,
    })), { video: true, title: true, time: 2, comment: 'Keep this draft' });
    await page.evaluate(() => document.dispatchEvent(new Event('yt-navigate-finish', { bubbles: true })));
    assert.equal(await page.locator(host).count(), 0);

    const manager = await context.newPage();
    await manager.goto('chrome://extensions/');
    const extension = manager.locator('extensions-item').filter({ hasText: 'FOVILO (Development)' });
    await extension.waitFor({ state: 'attached' });
    const extensionId = await extension.getAttribute('id');
    assert.match(extensionId, /^[a-p]{32}$/);
    await manager.goto('chrome-extension://' + extensionId + '/popup.html');
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const shortcutDescription = await worker.evaluate(() => chrome.i18n.getMessage('shortcutDescription'));
    assert.deepEqual(await worker.evaluate(async () => {
      const command = (await chrome.commands.getAll()).find((entry) => entry.name === 'open-commands');
      return [command?.shortcut, chrome.commands.onCommand.hasListeners()];
    }), ['', true]);
    const shortcutsPromise = context.waitForEvent('page');
    await manager.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    const shortcuts = await shortcutsPromise;
    await shortcuts.waitForURL('chrome://extensions/shortcuts');
    await shortcuts.getByText(shortcutDescription, { exact: true }).waitFor();
    await shortcuts.getByRole('button', { name: new RegExp(shortcutDescription) }).click();
    await shortcuts.keyboard.press('Control+Shift+9');
    assert.equal(await worker.evaluate(async () =>
      (await chrome.commands.getAll()).find((entry) => entry.name === 'open-commands')?.shortcut), 'Ctrl+Shift+9');
    await shortcuts.close();
    const popupCdp = await context.newCDPSession(manager);
    assert.equal((await politeStatusNodes(popupCdp)).length, 1);
    await popupCdp.detach();
    const globalToggle = manager.getByRole('checkbox', { name: 'Enable FOVILO' });
    const watchToggle = manager.getByRole('checkbox', { name: 'Watch controls' });
    await globalToggle.waitFor();
    assert.equal(await globalToggle.isChecked(), false);
    await globalToggle.check();
    await page.locator(host).waitFor();
    await watchToggle.uncheck();
    await page.locator(host).waitFor({ state: 'detached' });
    await watchToggle.check();
    await page.locator(host).waitFor();
    assert.equal(await page.locator(host).count(), 1);

    async function sendShortcut() {
      const sender = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      await sender.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ index: 0, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, { type: 'fovilo.open-commands' }, { frameId: 0 });
      });
    }
    await page.bringToFront();
    await page.getByRole('textbox', { name: 'Native comment' }).focus();
    await sendShortcut();
    assert.equal(await commandDialog.count(), 0);
    const video = page.locator('video');
    await video.focus();
    await sendShortcut();
    await commandDialog.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await video.evaluate((element) => document.activeElement === element), true);
    await video.evaluate((element) => element.addEventListener('click', () => {
      void element.requestFullscreen();
    }, { once: true }));
    await video.click({ position: { x: 10, y: 10 } });
    await page.waitForFunction(() => document.fullscreenElement !== null);
    await sendShortcut();
    assert.equal(await commandDialog.count(), 0);
    await page.evaluate(() => document.exitFullscreen());

    const homeToggle = manager.getByRole('checkbox', { name: 'Home controls' });
    await page.evaluate(async () => {
      const home = document.querySelector('ytd-browse[page-subtype="home"]');
      home.removeAttribute('page-subtype');
      history.pushState(null, '', '/');
      await new Promise((resolve) => setTimeout(resolve, 900));
      home.setAttribute('page-subtype', 'home');
    });
    await homeRail.waitFor();
    await homeRail.getByRole('button', { name: 'Commands', exact: true }).click();
    assert.equal(await homeRail.getByRole('list', { name: 'Recent commands' }).count(), 0);
    await page.keyboard.press('Escape');
    await homeToggle.uncheck();
    await homeRail.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('heading', { name: 'Native empty feed' }).isVisible(), true);
    await homeToggle.check();
    await homeRail.waitFor();
    await page.evaluate(() => history.back());
    await homeRail.waitFor({ state: 'detached' });
    await page.locator(host).waitFor();

    const searchToggle = manager.getByRole('checkbox', { name: 'Search controls' });
    const searchHost = page.locator('[data-fovilo-search]');
    await page.evaluate(() => history.pushState(null, '', '/results?search_query=fixture'));
    await searchHost.waitFor();
    assert.equal(await page.locator(host).count(), 0);
    const density = searchHost.getByRole('button', { name: 'Compact results' });
    const result = page.locator('ytd-video-renderer');
    const spacing = () => result.evaluate((element) => getComputedStyle(element).marginBlockStart);
    assert.equal(await spacing(), '16px');
    await density.focus();
    await page.keyboard.press('Space');
    assert.equal(await density.getAttribute('aria-pressed'), 'true');
    assert.equal(await spacing(), '8px');
    assert.equal(await page.getByRole('button', { name: 'Native filters' }).isVisible(), true);
    assert.equal(await page.getByRole('link', { name: 'Native search result' }).getAttribute('href'), watch(first));
    await searchToggle.uncheck();
    await searchHost.waitFor({ state: 'detached' });
    assert.equal(await spacing(), '16px');
    await searchToggle.check();
    await searchHost.waitFor();
    assert.equal(await spacing(), '8px');
    await density.click();
    assert.equal(await spacing(), '16px');
    const searchRestore = searchHost.getByRole('button', { name: 'Return to YouTube' });
    await searchRestore.focus();
    await page.keyboard.press('Enter');
    await searchHost.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('textbox', { name: 'Native search' }).evaluate((input) =>
      input === document.activeElement), true);
    await globalToggle.check();
    await searchHost.waitFor();
    await page.evaluate(() => history.back());
    await searchHost.waitFor({ state: 'detached' });
    await page.locator(host).waitFor();

    await page.evaluate(async (path) => {
      const root = document.querySelector('ytd-watch-flexy');
      history.pushState(null, '', '/results?search_query=fixture');
      root.remove();
      history.pushState(null, '', path);
      await new Promise((resolve) => setTimeout(resolve, 900));
      document.body.append(root);
    }, watch(first));
    await page.locator(host).waitFor();
    assert.equal(await page.locator(host).count(), 1);

    await manager.goto('chrome://extensions/');
    const browserToggle = extension.locator('#enableToggle');
    await browserToggle.click();
    await page.reload();
    await page.getByRole('heading', { name: 'Native title' }).waitFor();
    assert.equal(await page.locator(host).count(), 0);
    await browserToggle.click();
    await page.reload();
    await page.locator(host).waitFor();
    assert.equal(await page.locator(host).count(), 1);

    await context.clearPermissions();
    await page.goto(origin + blockedWatch);
    await page.waitForFunction(() => document.querySelector('video').readyState > 0);
    await commands.click();
    assert.equal(await recent.count(), 0);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 640, height: 800 });
    const initialViewport = await page.evaluate(() => ({ width: innerWidth, scale: devicePixelRatio }));
    await manager.goto('chrome-extension://' + extensionId + '/popup.html');
    const zoom = await manager.evaluate(async () => {
      const [watchTab] = await chrome.tabs.query({ index: 0, currentWindow: true });
      await chrome.tabs.setZoom(watchTab.id, 2);
      return chrome.tabs.getZoom(watchTab.id);
    });
    assert.equal(zoom, 2);
    await page.bringToFront();
    await page.waitForFunction(({ width, scale }) => innerWidth === width / 2 && devicePixelRatio === scale * 2, initialViewport);

    const cdp = await context.newCDPSession(page);
    const [liveRegion] = await politeStatusNodes(cdp);
    assert.ok(liveRegion, 'the empty polite status region should exist before interaction');

    await page.getByRole('link', { name: 'Native action' }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.getByRole('status').getByText('Clipboard unavailable. Copy the link manually.').waitFor();
    const fallback = page.getByRole('textbox', { name: 'Time link for manual copying' });
    assert.equal(await fallback.inputValue(), origin + watch(first) + '&t=0s');
    assert.ok((await politeStatusNodes(cdp)).some((node) => node.backendDOMNodeId === liveRegion.backendDOMNodeId));
    assert.deepEqual(await page.locator(host).evaluate((host) => {
      const panel = host.shadowRoot.querySelector('section');
      const bounds = panel.getBoundingClientRect();
      const fits = (element) => {
        const child = element.getBoundingClientRect();
        return child.width > 0 && child.left >= bounds.left && child.right <= bounds.right;
      };
      return {
        panelFits: bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth,
        noPanelOverflow: panel.scrollWidth === panel.clientWidth,
        controlsFit: [...panel.querySelectorAll('button, input, [role=status]')].every(fits),
      };
    }), { panelFits: true, noPanelOverflow: true, controlsFit: true });
    assert.equal(await fallback.evaluate((input) =>
      input.getRootNode().activeElement === input && input.selectionStart === 0 &&
      input.selectionEnd === input.value.length), true);
    await page.keyboard.press('Shift+Tab');
    await page.waitForFunction(() => document.querySelector('[data-fovilo-watch]').shadowRoot.activeElement?.textContent === 'Return to YouTube');
    await page.keyboard.press('Enter');
    await page.locator(host).waitFor({ state: 'detached' });
    await sendShortcut();
    assert.equal(await commandDialog.count(), 0);
    const title = page.getByRole('heading', { name: 'Native title' });
    assert.deepEqual(await hierarchy(), ['500', '400', '500']);
    assert.equal(await title.evaluate((heading) => heading === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('link', { name: 'Native action' }).evaluate((link) =>
      link === document.activeElement), true);
    assert.equal(await title.getAttribute('tabindex'), null);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('Simplified Chinese labels and commands remain usable at 200 percent zoom', async () => {
  const work = resolve('work');
  await mkdir(work, { recursive: true });
  const profile = await mkdtemp(join(work, 'zh-chromium-'));
  let context;
  try {
    const dist = resolve('dist');
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', locale: 'zh-CN', viewport: { width: 640, height: 900 },
      args: ['--disable-extensions-except=' + dist, '--load-extension=' + dist],
    });
    await context.route(origin + watch(first), (route) => route.fulfill({
      contentType: 'text/html',
      headers: { 'Permissions-Policy': 'clipboard-write=()' },
      body: `<!doctype html><html lang="zh-CN"><title>中文夹具</title>
        <ytd-watch-flexy video-id="${first}">
          <div id="primary-inner"><div id="player"><div id="movie_player">
            <video class="html5-main-video" src="${audioFixture()}" controls></video>
          </div></div></div>
          <div id="above-the-fold"><h1>原生视频标题</h1></div>
        </ytd-watch-flexy>
        <ytd-search><div id="primary"><ytd-item-section-renderer><div id="contents">
          <ytd-video-renderer><a href="${watch(first)}">原生结果</a></ytd-video-renderer>
        </div></ytd-item-section-renderer></div></ytd-search>
        <ytd-browse page-subtype="home"><div id="primary">原生首页</div></ytd-browse>
      </html>`,
    }));
    const page = context.pages()[0];
    await page.goto(origin + watch(first));
    const rail = page.locator(host);
    await rail.waitFor();
    assert.equal(await rail.getAttribute('lang'), 'zh-CN');
    const manager = await context.newPage();
    await manager.goto('chrome://extensions/');
    const item = manager.locator('extensions-item').filter({ hasText: 'FOVILO (Development)' });
    const id = await item.getAttribute('id');
    await manager.goto('chrome-extension://' + id + '/popup.html');
    await manager.getByRole('checkbox', { name: '播放页控件' }).waitFor();
    assert.equal(await manager.locator('html').getAttribute('lang'), 'zh-CN');
    assert.equal(await manager.getByRole('button', { name: '键盘快捷键' }).isVisible(), true);
    await manager.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ index: 0, currentWindow: true });
      await chrome.tabs.setZoom(tab.id, 2);
    });
    await manager.close();
    await page.waitForFunction(() => innerWidth === 320 && devicePixelRatio >= 2);
    const launcher = rail.getByRole('button', { name: '命令', exact: true });
    await launcher.focus();
    await page.keyboard.press('Enter');
    const dialog = rail.getByRole('dialog', { name: '命令' });
    await dialog.getByRole('searchbox', { name: '查找命令' }).fill('影院');
    await page.keyboard.press('Enter');
    await rail.getByText('已启用影院模式。').waitFor();
    assert.equal(await rail.getByRole('button', { name: '影院', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await rail.getByRole('button', { name: '播放页控件 · 影院' }).isVisible(), true);
    await page.waitForFunction(() => document.querySelector('video').readyState > 0);
    await rail.getByRole('button', { name: '复制时间链接' }).press('Enter');
    await rail.getByText('无法写入剪贴板，请手动复制链接。').waitFor();
    const manual = rail.getByRole('textbox', { name: '可手动复制的时间链接' });
    assert.equal(await manual.inputValue(), origin + watch(first) + '&t=0s');
    assert.equal(await rail.evaluate((element) => {
      const panel = element.shadowRoot.querySelector('section');
      return panel.scrollWidth === panel.clientWidth;
    }), true);

    await page.evaluate(() => history.pushState(null, '', '/results?search_query=fixture'));
    const search = page.locator('[data-fovilo-search]');
    await search.getByRole('button', { name: '紧凑结果' }).press('Enter');
    await search.getByText('已启用紧凑搜索结果。').waitFor();
    await page.evaluate(() => history.pushState(null, '', '/'));
    const home = page.locator('[data-fovilo-home]');
    assert.equal(await home.getByRole('link', { name: '订阅' }).getAttribute('href'), '/feed/subscriptions');
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('English fallback follows native RTL layout and keeps timestamp URLs left-to-right', async () => {
  const work = resolve('work');
  await mkdir(work, { recursive: true });
  const profile = await mkdtemp(join(work, 'rtl-chromium-'));
  let context;
  try {
    const dist = resolve('dist');
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', locale: 'ar-SA', viewport: { width: 640, height: 800 },
      args: ['--disable-extensions-except=' + dist, '--load-extension=' + dist],
    });
    await context.route(origin + watch(first), (route) => route.fulfill({
      contentType: 'text/html',
      headers: { 'Permissions-Policy': 'clipboard-write=()' },
      body: `<!doctype html><html lang="ar" dir="rtl"><title>فيديو</title>
        <ytd-watch-flexy video-id="${first}">
          <div id="movie_player"><video class="html5-main-video" src="${audioFixture()}" controls></video></div>
          <div id="above-the-fold"><h1>عنوان الفيديو</h1></div>
        </ytd-watch-flexy>
      </html>`,
    }));
    const page = context.pages()[0];
    await page.goto(origin + watch(first));
    const rail = page.locator(host);
    const copy = rail.getByRole('button', { name: 'Copy time link' });
    await copy.waitFor();
    assert.equal(await rail.getAttribute('lang'), 'en');
    assert.equal(await rail.evaluate((element) => getComputedStyle(element).direction), 'rtl');
    const disclosure = await rail.getByRole('button', { name: 'Watch controls' }).boundingBox();
    const restore = await rail.getByRole('button', { name: 'Return to YouTube' }).boundingBox();
    assert.ok(disclosure.x > restore.x);
    await page.waitForFunction(() => document.querySelector('video').readyState > 0);
    await copy.press('Enter');
    const manual = rail.getByRole('textbox', { name: 'Time link for manual copying' });
    assert.equal(await manual.inputValue(), origin + watch(first) + '&t=0s');
    assert.equal(await manual.evaluate((element) => getComputedStyle(element).direction), 'ltr');
    const commands = rail.getByRole('button', { name: 'Commands', exact: true });
    await commands.press('Enter');
    const dialog = rail.getByRole('dialog', { name: 'Commands' });
    const search = dialog.getByRole('searchbox', { name: 'Find a command' });
    await search.fill('بحث');
    assert.equal(await search.evaluate((element) => getComputedStyle(element).direction), 'rtl');
    await page.keyboard.press('Escape');
    assert.equal(await commands.evaluate((element) => element.getRootNode().activeElement === element), true);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
