import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const origin = 'https://www.youtube.com';
const videoId = 'aqz-KE-bpKQ';
const query = 'Big Buck Bunny 60fps 4K Blender aqz-KE-bpKQ';

function waitForPlayableVideo(page) {
  return page.waitForFunction(() => {
    const player = document.querySelector('#movie_player');
    const video = player?.querySelector('video.html5-main-video');
    return video?.readyState >= 2 && Number.isFinite(video.duration) &&
      !player.matches('.ad-showing, .ad-interrupting');
  });
}

async function withLivePage(run) {
  await mkdir('work', { recursive: true });
  const profile = await mkdtemp(join(resolve('work'), 'live-'));
  let context;
  try {
    const dist = resolve('dist');
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      args: ['--disable-extensions-except=' + dist, '--load-extension=' + dist],
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
    });
    const page = context.pages()[0];
    page.setDefaultTimeout(20_000);
    await run(page, context);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
}

test('signed-out YouTube navigation and persistent recovery', { timeout: 120_000 }, (t) =>
  withLivePage(async (page, context) => {
    const host = page.locator('[data-fovilo-watch]');
    const search = page.locator('input[name="search_query"]').first();
    async function runSearch() {
      await search.fill(query);
      await search.press('Enter');
      await page.waitForURL((url) => url.pathname === '/results' && url.searchParams.get('search_query') === query);
      await host.waitFor({ state: 'detached' });
    }

    const response = await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await search.waitFor();
    assert.equal(await host.count(), 0);
    t.diagnostic('Home loaded without a Watch control');
    await runSearch();
    const result = page.locator('ytd-video-renderer a#video-title[href*="/watch?v=' + videoId + '"]').first();
    await result.click();
    await page.waitForURL((url) => url.pathname === '/watch' && url.searchParams.get('v') === videoId);
    await host.waitFor();
    assert.equal(await host.count(), 1);
    t.diagnostic('Search result opened with one Watch control');

    await runSearch();
    await page.goBack({ waitUntil: 'commit' });
    await host.waitFor();
    assert.equal(await host.count(), 1);
    await page.goForward({ waitUntil: 'commit' });
    await host.waitFor({ state: 'detached' });
    await page.goBack({ waitUntil: 'commit' });
    await host.waitFor();
    t.diagnostic('Watch → Search → Back → Forward → Back preserved the mount boundary');

    assert.deepEqual(await host.evaluate((element) => {
      const anchor = element.parentElement;
      return ['#title h1', '#owner #channel-name a', '#description-inner #info'].map((selector) =>
        getComputedStyle(anchor.querySelector(selector)).fontWeight);
    }), ['700', '600', '400']);
    t.diagnostic('Everyday hierarchy applied to the native title, channel and metadata');

    const fullscreen = page.locator('#movie_player .ytp-fullscreen-button');
    await page.locator('#movie_player').hover();
    await fullscreen.click();
    await page.waitForFunction(() => {
      const player = document.querySelector('#movie_player');
      return player && document.fullscreenElement?.contains(player);
    });
    await page.locator('#movie_player').hover();
    await fullscreen.click();
    await page.waitForFunction(() => document.fullscreenElement === null);
    assert.equal(await host.count(), 1);
    t.diagnostic('The native player entered and exited fullscreen with one Watch control');

    const initialViewport = await page.evaluate(() => ({ width: innerWidth, scale: devicePixelRatio }));
    const manager = await context.newPage();
    try {
      await manager.goto('chrome://extensions/');
      const extension = manager.locator('extensions-item').filter({ hasText: 'FOVILO (Development)' });
      const extensionId = await extension.getAttribute('id');
      assert.match(extensionId, /^[a-p]{32}$/);
      await manager.goto('chrome-extension://' + extensionId + '/popup.html');
      await manager.evaluate(async () => {
        const [watchTab] = await chrome.tabs.query({ index: 0, currentWindow: true });
        await chrome.tabs.setZoom(watchTab.id, 2);
      });
    } finally {
      await manager.close();
    }
    await page.waitForFunction(({ width, scale }) => innerWidth === width / 2 && devicePixelRatio === scale * 2, initialViewport);

    await waitForPlayableVideo(page);
    const copy = page.getByRole('button', { name: 'Copy time link' });
    await copy.focus();
    await page.keyboard.press('Enter');
    await host.getByText('Time link copied.').waitFor();
    assert.equal(await host.evaluate((element) => {
      const panel = element.shadowRoot.querySelector('section');
      const bounds = panel.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth &&
        panel.scrollWidth === panel.clientWidth;
    }), true);
    assert.equal(await copy.evaluate((button) => button.getRootNode().activeElement === button), true);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.querySelector('[data-fovilo-watch]').shadowRoot.activeElement?.textContent === 'Return to YouTube');
    await page.keyboard.press('Enter');
    await host.waitFor({ state: 'detached' });
    const title = page.locator('ytd-watch-flexy[video-id="' + videoId + '"] #above-the-fold h1').first();
    assert.equal(await title.evaluate((heading) => document.activeElement === heading), true);
    t.diagnostic('At 200% tab zoom, default clipboard write worked by keyboard, the panel fit, and Return to YouTube restored native focus');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('ytd-watch-flexy[video-id="' + videoId + '"] #above-the-fold').waitFor({ state: 'attached' });
    await page.evaluate(() => {
      document.dispatchEvent(new Event('yt-navigate-finish', { bubbles: true }));
    });
    assert.equal(await host.count(), 0);
    t.diagnostic('Global off persisted after reloading the live Watch page');
  }),
);

test('playlist handoffs and native captions preserve Watch controls', { timeout: 120_000 }, (t) =>
  withLivePage(async (page, context) => {
    const playlist = 'PLav47HAVZMjnTFVZL-aImCQIC0uLZtNCz';
    const sintel = 'eRsGyueVLvQ';
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    const host = page.locator('[data-fovilo-watch]');
    const copy = page.getByRole('button', { name: 'Copy time link' });
    const player = page.locator('#movie_player');
    const media = player.locator('video.html5-main-video');

    async function assertTimeLink(id, seconds) {
      await waitForPlayableVideo(page);
      await media.evaluate((video, time) => {
        video.pause();
        video.currentTime = time;
      }, seconds);
      await page.waitForFunction((time) => {
        const video = document.querySelector('#movie_player video.html5-main-video');
        return video && !video.seeking && Math.floor(video.currentTime) === time;
      }, seconds);
      await copy.click();
      await host.getByText('Time link copied.').waitFor();
      const link = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(link, origin + '/watch?v=' + id + '&t=' + seconds + 's');
    }

    const response = await page.goto(origin + '/watch?v=' + videoId + '&list=' + playlist, {
      waitUntil: 'domcontentloaded',
    });
    assert.equal(response?.status(), 200);
    await host.waitFor();
    await assertTimeLink(videoId, 4);

    const episode = page.locator('ytd-playlist-panel-video-renderer a[href*="/watch?v=' + sintel + '"]').first();
    await episode.click();
    await page.waitForURL((url) => url.searchParams.get('v') === sintel && url.searchParams.get('list') === playlist);
    await host.waitFor();
    assert.equal(await host.count(), 1);
    await assertTimeLink(sintel, 12);
    t.diagnostic('Copied matching timestamps before and after a native playlist selection');

    const captions = player.locator('.ytp-subtitles-button');
    await player.hover();
    const before = await captions.getAttribute('aria-pressed');
    assert.match(before, /^(true|false)$/);
    await captions.click();
    await page.waitForFunction((previous) => {
      const button = document.querySelector('#movie_player .ytp-subtitles-button');
      return button?.getAttribute('aria-pressed') === (previous === 'true' ? 'false' : 'true');
    }, before);
    assert.equal(await host.count(), 1);
    t.diagnostic('Toggled native captions after the playlist handoff');

    await t.test('native English track selection', async () => {
      const settings = player.locator('.ytp-settings-button');
      await player.hover();
      await settings.click();
      const subtitleMenu = player.getByRole('menuitem', { name: /subtitles/i });
      await subtitleMenu.click();
      const english = player.getByRole('menuitemradio', { name: /^English$/i });
      await english.click();
      await subtitleMenu.getByText('English', { exact: true }).waitFor();
    });

    const next = new URL(await player.locator('.ytp-next-button').getAttribute('href'), origin);
    const nextId = next.searchParams.get('v');
    assert.match(nextId, /^[\w-]{11}$/);
    assert.notEqual(nextId, sintel);
    const end = await media.evaluate((video) => Math.floor(video.duration) - 4);
    assert.ok(end > 128);
    await page.goto(origin + '/watch?v=' + sintel + '&list=' + playlist + '&t=' + end + 's', {
      waitUntil: 'domcontentloaded',
    });
    await media.evaluate((video) => { video.muted = true; });
    if (await media.evaluate((video) => video.paused)) {
      await player.hover();
      await player.locator('.ytp-play-button').click();
    }
    await page.waitForURL((url) => url.searchParams.get('v') === nextId && url.searchParams.get('list') === playlist);
    await host.waitFor();
    assert.equal(await host.count(), 1);
    await assertTimeLink(nextId, 6);
    t.diagnostic('Native end-of-video advancement mounted one control and copied the next episode timestamp');
  }),
);
