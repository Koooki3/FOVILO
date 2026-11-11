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
      args: ['--disable-extensions-except=' + dist, '--load-extension=' + dist],
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await context.route('**/*', (route) => {
      if (route.request().url().startsWith('chrome-extension://')) return route.continue();
      if (route.request().url() !== origin + '/') return route.abort();
      return route.fulfill({ contentType: 'text/html', body: `
        <!doctype html><title>YouTube fixture</title>
        <ytd-watch-flexy video-id="${first}">
          <div id="movie_player"><video class="html5-main-video" controls
            src="${audioFixture()}"></video></div>
          <div id="above-the-fold"><h1>Native title</h1></div>
          <textarea aria-label="Native comment"></textarea>
        </ytd-watch-flexy>` });
    });

    const page = context.pages()[0];
    await page.goto(origin + '/');
    assert.equal(await page.locator(host).count(), 0);
    await page.evaluate((path) => {
      window.nativeVideo = document.querySelector('video');
      window.nativeTitle = document.querySelector('h1');
      history.pushState(null, '', path);
    }, watch(first));
    await page.locator(host).waitFor();
    await page.waitForFunction(() => window.nativeVideo.readyState > 0);
    await page.evaluate(() => { window.nativeVideo.currentTime = 2; });
    await page.getByRole('button', { name: 'Copy time link' }).click();
    await page.getByText('Time link copied.').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), origin + watch(first) + '&t=2s');
    await page.locator('#movie_player').evaluate((el) => el.classList.add('ad-showing'));
    await page.getByRole('button', { name: 'Copy time link' }).click();
    await page.getByText('The video timestamp is unavailable.').waitFor();
    await page.locator('#movie_player').evaluate((el) => el.classList.remove('ad-showing'));

    await page.evaluate((path) => history.pushState(null, '', path), watch(second));
    await page.locator(host).waitFor({ state: 'detached' });
    await page.evaluate((id) => {
      document.querySelector('ytd-watch-flexy').setAttribute('video-id', id);
      for (let index = 0; index < 20; index += 1) {
        document.dispatchEvent(new Event('yt-navigate-finish', { bubbles: true }));
      }
    }, second);
    await page.locator(host).waitFor();
    assert.equal(await page.locator(host).count(), 1);
    await page.getByRole('button', { name: 'Copy time link' }).click();
    await page.getByText('The video timestamp is unavailable.').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), origin + watch(first) + '&t=2s');
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
    await page.getByRole('button', { name: 'Return to YouTube' }).click();
    await page.locator(host).waitFor({ state: 'detached' });
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
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
