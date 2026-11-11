import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const origin = 'https://www.youtube.com';
const videoId = 'aqz-KE-bpKQ';
const query = 'Big Buck Bunny 60fps 4K Blender aqz-KE-bpKQ';

test('signed-out YouTube navigation and persistent recovery', { timeout: 120_000 }, async (t) => {
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

    await page.getByRole('button', { name: 'Return to YouTube' }).click();
    await host.waitFor({ state: 'detached' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('ytd-watch-flexy[video-id="' + videoId + '"] #above-the-fold').waitFor({ state: 'attached' });
    await page.evaluate(() => {
      document.dispatchEvent(new Event('yt-navigate-finish', { bubbles: true }));
    });
    assert.equal(await host.count(), 0);
    t.diagnostic('Global off persisted after reloading the live Watch page');
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
