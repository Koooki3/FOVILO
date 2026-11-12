import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const origin = 'https://www.youtube.com';
const videoId = 'aqz-KE-bpKQ';
const query = 'Big Buck Bunny 60fps 4K Official Blender Foundation Short Film';

function waitForPlayableVideo(page) {
  return page.waitForFunction(() => {
    const player = document.querySelector('#movie_player');
    const video = player?.querySelector('video.html5-main-video');
    return video?.readyState >= 2 && Number.isFinite(video.duration) &&
      !player.matches('.ad-showing, .ad-interrupting');
  });
}

async function toggleFullscreen(page, active) {
  const player = page.locator('#movie_player');
  await player.hover();
  await player.locator('.ytp-fullscreen-button').click();
  await page.waitForFunction((active) => {
    if (!active) return document.fullscreenElement === null;
    const player = document.querySelector('#movie_player');
    return player && document.fullscreenElement?.contains(player);
  }, active);
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
    const searchRail = page.locator('[data-fovilo-search]');
    const homeRail = page.locator('[data-fovilo-home]');
    const search = page.locator('input[name="search_query"]:visible').first();
    async function runSearch() {
      await search.fill(query);
      await search.press('Enter');
      await page.waitForURL((url) => url.pathname === '/results' && url.searchParams.get('search_query') === query);
      await host.waitFor({ state: 'detached' });
      await homeRail.waitFor({ state: 'detached' });
      await searchRail.waitFor();
    }

    const response = await page.goto(origin + '/', { waitUntil: 'commit' });
    assert.equal(response?.status(), 200);
    await search.waitFor();
    await homeRail.waitFor();
    assert.equal(await host.count(), 0);
    t.diagnostic('Home loaded one Home rail and no Watch control');
    await runSearch();
    const density = searchRail.getByRole('button', { name: 'Compact results' });
    const resultRow = page.locator('ytd-search #primary ytd-item-section-renderer > #contents > ytd-video-renderer').first();
    const spacing = () => resultRow.evaluate((element) => getComputedStyle(element).marginBlockStart);
    const nativeSpacing = await spacing();
    const thumbnail = resultRow.locator('#dismissible > ytd-thumbnail');
    await searchRail.getByRole('button', { name: 'Commands', exact: true }).click();
    await searchRail.getByRole('searchbox', { name: 'Find a command' }).fill('compact results');
    await page.keyboard.press('Enter');
    assert.equal(await density.getAttribute('aria-pressed'), 'true');
    assert.equal(await spacing(), '8px');
    assert.equal(await thumbnail.evaluate((element) => getComputedStyle(element).maxInlineSize), '360px');
    await page.waitForFunction(() => document.querySelectorAll('[data-fovilo-search]').length === 1);
    const result = page.locator('a[href*="/watch?v=' + videoId + '"]:visible').first();
    await result.click();
    await page.waitForURL((url) => url.pathname === '/watch' && url.searchParams.get('v') === videoId);
    await host.waitFor();
    await searchRail.waitFor({ state: 'detached' });
    assert.equal(await host.count(), 1);
    const rail = host.getByRole('button', { name: /^Watch controls/ });
    await rail.focus();
    await page.keyboard.press('Space');
    assert.equal(await rail.getAttribute('aria-expanded'), 'false');
    assert.equal(await host.getByRole('button', { name: 'Return to YouTube' }).isVisible(), true);
    t.diagnostic('Search result opened with one Watch control');

    await runSearch();
    assert.equal(await density.getAttribute('aria-pressed'), 'true');
    await density.click();
    assert.equal(await density.getAttribute('aria-pressed'), 'false');
    assert.equal(await spacing(), nativeSpacing);
    t.diagnostic('Search density changed and restored native results, persisted within the session, and left native navigation working');
    await page.goBack({ waitUntil: 'commit' });
    await host.waitFor();
    assert.equal(await host.count(), 1);
    await page.goForward({ waitUntil: 'commit' });
    await host.waitFor({ state: 'detached' });
    await page.goBack({ waitUntil: 'commit' });
    await host.waitFor();
    assert.equal(await rail.getAttribute('aria-expanded'), 'false');
    assert.equal(await host.getByRole('button', { name: 'Copy time link' }).count(), 0);
    await rail.focus();
    await page.keyboard.press('Enter');
    assert.equal(await rail.getAttribute('aria-expanded'), 'true');
    t.diagnostic('Watch rail disclosure survived native navigation and reopened by keyboard');
    t.diagnostic('Watch → Search → Back → Forward → Back preserved the mount boundary');

    assert.deepEqual(await host.evaluate((element) => {
      const anchor = element.parentElement;
      return ['#title h1', '#owner #channel-name a', '#description-inner #info'].map((selector) =>
        getComputedStyle(anchor.querySelector(selector)).fontWeight);
    }), ['700', '600', '400']);
    t.diagnostic('Everyday hierarchy applied to the native title, channel and metadata');

    const focus = host.getByRole('button', { name: 'Focus', exact: true });
    const cinema = host.getByRole('button', { name: 'Cinema', exact: true });
    const recommendations = page.locator('ytd-watch-flexy[video-id="' + videoId + '"] #secondary-inner > #related');
    const media = page.locator('#movie_player video.html5-main-video');
    await recommendations.waitFor();
    await waitForPlayableVideo(page);
    const original = await media.elementHandle();
    const playback = await media.evaluate((video) => ({ paused: video.paused, time: video.currentTime }));
    await focus.focus();
    await page.keyboard.press('Space');
    await recommendations.waitFor({ state: 'hidden' });
    assert.equal(await focus.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#comments').first().count(), 1);
    assert.equal(await media.evaluate((video, state) =>
      video === state.original && video.paused === state.playback.paused &&
      video.currentTime >= state.playback.time, { original, playback }), true);
    await page.keyboard.press('Space');
    await recommendations.waitFor();
    assert.equal(await focus.getAttribute('aria-pressed'), 'false');
    t.diagnostic('Focus toggled native recommendations without replacing the video or changing playback state');

    await toggleFullscreen(page, true);
    await toggleFullscreen(page, false);
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
    for (const mode of [focus, cinema]) {
      if (!(await mode.isVisible())) continue;
      assert.equal(await mode.evaluate((button) => button.getRootNode().activeElement === button), true);
      await page.keyboard.press('Tab');
    }
    const commands = host.getByRole('button', { name: 'Commands', exact: true });
    assert.equal(await commands.evaluate((button) => button.getRootNode().activeElement === button), true);
    await page.keyboard.press('Enter');
    const dialog = host.getByRole('dialog', { name: 'Commands' });
    const commandSearch = dialog.getByRole('searchbox', { name: 'Find a command' });
    await commandSearch.fill('copy time');
    assert.equal(await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth &&
        bounds.top >= 0 && bounds.bottom <= innerHeight;
    }), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await commands.evaluate((button) => button.getRootNode().activeElement === button), true);
    t.diagnostic('Watch Commands fit at 200% zoom and Escape restored the launcher focus');
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

test('Home rail leads to native Subscriptions and leaves the destination alone', { timeout: 60_000 }, (t) =>
  withLivePage(async (page) => {
    const response = await page.goto(origin + '/', { waitUntil: 'commit' });
    assert.equal(response?.status(), 200);
    const rail = page.locator('[data-fovilo-home]');
    const toggle = rail.getByRole('button', { name: 'Home controls' });
    const link = rail.getByRole('link', { name: 'Subscriptions' });
    await toggle.focus();
    await page.keyboard.press('Space');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await link.count(), 0);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal(await link.evaluate((anchor) => anchor.getRootNode().activeElement === anchor), true);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await rail.getByRole('searchbox', { name: 'Find a command' }).fill('open subscriptions');
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.origin === origin && url.pathname === '/feed/subscriptions');
    await rail.waitFor({ state: 'detached' });
    t.diagnostic('The keyboard command opened native Subscriptions and removed the Home rail');
  }),
);

test('Cinema preserves inline playback and yields to native fullscreen', { timeout: 120_000 }, (t) =>
  withLivePage(async (page) => {
    await page.goto(origin + '/watch?v=' + videoId, { waitUntil: 'domcontentloaded' });
    const host = page.locator('[data-fovilo-watch]');
    const cinema = host.getByRole('button', { name: 'Cinema', exact: true });
    const stage = page.locator('ytd-watch-flexy[video-id="' + videoId + '"] #primary-inner > #player');
    const recommendations = page.locator('ytd-watch-flexy[video-id="' + videoId + '"] #secondary-inner > #related');
    const media = page.locator('#movie_player video.html5-main-video');
    await cinema.waitFor();
    await waitForPlayableVideo(page);
    const hadRecommendations = await recommendations.isVisible();
    const shadow = () => stage.evaluate((element) => getComputedStyle(element).boxShadow);
    const nativeShadow = await shadow();
    const inlineStage = await stage.elementHandle();
    const stageBounds = await stage.boundingBox();
    const original = await media.elementHandle();
    await cinema.focus();
    await page.keyboard.press('Enter');
    assert.equal(await cinema.getAttribute('aria-pressed'), 'true');
    if (hadRecommendations) await recommendations.waitFor({ state: 'hidden' });
    assert.notEqual(await shadow(), nativeShadow);
    const cinemaBounds = await stage.boundingBox();
    assert.equal(cinemaBounds.width, stageBounds.width);
    assert.equal(cinemaBounds.height, stageBounds.height);
    assert.equal(await media.evaluate((video, original) => video === original, original), true);
    await toggleFullscreen(page, true);
    assert.equal(await inlineStage.evaluate((element, originalShadow) =>
      !element.isConnected || getComputedStyle(element).boxShadow === originalShadow, nativeShadow), true);
    await toggleFullscreen(page, false);
    assert.notEqual(await shadow(), nativeShadow);
    await cinema.click();
    if (hadRecommendations) await recommendations.waitFor();
    assert.equal(await shadow(), nativeShadow);
    t.diagnostic('Cinema preserved video identity and size, suspended its matte in fullscreen, and restored Everyday on exit');
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
      waitUntil: 'commit',
    });
    assert.equal(response?.status(), 200);
    await host.waitFor();
    await assertTimeLink(videoId, 4);
    assert.equal(await host.getByRole('button', { name: 'Focus', exact: true }).count(), 0);
    assert.equal(await host.getByRole('button', { name: 'Cinema', exact: true }).count(), 0);

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
