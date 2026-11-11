import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const live = process.argv.includes('--live');
const videoId = 'aqz-KE-bpKQ';
const url = 'https://www.youtube.com/watch?v=' + videoId;
const modes = ['native', 'off', 'on'];
const rounds = 6;
const windowMs = 1500;
const viewport = { width: 1280, height: 800 };
const output = resolve('work', live ? 'perf-live' : 'perf-fixture');
const dist = resolve('dist');
const counters = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'];

async function disableFovilo(context) {
  const manager = await context.newPage();
  try {
    await manager.goto('chrome://extensions/');
    const item = manager.locator('extensions-item').filter({ hasText: 'FOVILO (Development)' });
    await item.waitFor({ state: 'attached' });
    const id = await item.getAttribute('id');
    assert.match(id, /^[a-p]{32}$/);
    await manager.goto('chrome-extension://' + id + '/popup.html');
    await manager.getByRole('checkbox', { name: 'Enable FOVILO' }).uncheck();
    assert.equal(await manager.evaluate(async () => (await chrome.storage.local.get(['enabled'])).enabled), false);
  } finally {
    await manager.close();
  }
}

async function launch(mode) {
  const profile = await mkdtemp(join(output, mode + '-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      args: mode === 'native' ? [] : ['--disable-extensions-except=' + dist, '--load-extension=' + dist],
      locale: 'en-US',
      viewport,
    });
    if (mode === 'off') await disableFovilo(context);
    if (!live) {
      await context.route('**/*', (route) => {
        const request = route.request().url();
        if (request.startsWith('chrome-extension://')) return route.continue();
        if (request !== url) return route.abort();
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>Watch fixture</title><ytd-watch-flexy video-id="' + videoId +
            '"><div id="above-the-fold"><h1>Native Watch fixture</h1></div></ytd-watch-flexy>',
        });
      });
    }
    await context.addInitScript(() => {
      const paint = { lcpMs: null, cumulativeShift: null, longTasks: null };
      const observers = [];
      function observe(type, update) {
        if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
        const observer = new PerformanceObserver((list) => update(list.getEntries()));
        observer.observe({ type, buffered: true });
        observers.push(() => {
          update(observer.takeRecords());
          observer.disconnect();
        });
      }
      observe('largest-contentful-paint', (entries) => {
        if (entries.length) paint.lcpMs = entries.at(-1).startTime;
      });
      observe('layout-shift', (entries) => {
        paint.cumulativeShift = (paint.cumulativeShift ?? 0) +
          entries.filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0);
      });
      observe('longtask', (entries) => { paint.longTasks = (paint.longTasks ?? 0) + entries.length; });
      window.readFoviloPerf = () => {
        for (const stop of observers.splice(0)) stop();
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          dclMs: nav.domContentLoadedEventEnd,
          observedUntilMs: performance.now(),
          visibility: document.visibilityState,
          ...paint,
        };
      };
    });
    const page = context.pages()[0];
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    return {
      context,
      profile,
      page,
      cdp,
      browserVersion: (await cdp.send('Browser.getVersion')).product,
    };
  } catch (error) {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
    throw error;
  }
}

async function measure({ page, cdp }, mode) {
  const readCounters = async () => Object.fromEntries(
    (await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]),
  );
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200);
  assert.equal(page.url(), url);
  const before = await readCounters();

  // Use the same post-DCL window across modes. Observer callbacks do not drive sampling.
  await page.waitForTimeout(windowMs);
  const timings = await page.evaluate(() => window.readFoviloPerf());
  assert.equal(timings.visibility, 'visible');
  assert.ok(timings.dclMs > 0);
  const after = await readCounters();
  const hostCount = await page.locator('[data-fovilo-watch]').count();
  assert.equal(hostCount, mode === 'on' ? 1 : 0, mode + ' mount count');
  const rendererMs = Object.fromEntries(counters.map((name) => {
    const delta = (after[name] - before[name]) * 1000;
    // A renderer reset invalidates a cumulative counter delta.
    return [name, Number.isFinite(delta) && delta >= 0 ? delta : null];
  }));
  // Stop native playback and background page work before sampling the next profile.
  await page.goto('about:blank');
  return { ...timings, hostCount, rendererMs };
}

await mkdir(output, { recursive: true });
const samples = [];
const build = Object.fromEntries(await Promise.all(
  ['manifest.json', 'content.js'].map(async (file) => {
    const bytes = await readFile(join(dist, file));
    return [file, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
  }),
));
const report = {
  scenario: live ? 'signed-out live Watch navigation' : 'synthetic Watch navigation',
  startedAt: new Date().toISOString(),
  url, viewport, windowMs, rounds,
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, node: process.version },
  build, browsers: {}, samples,
};
const sessions = new Map();
try {
  for (const mode of modes) {
    const session = await launch(mode);
    sessions.set(mode, session);
    report.browsers[mode] = session.browserVersion;
    await measure(session, mode);
  }
  for (let round = 0; round < rounds; round += 1) {
    for (let offset = 0; offset < modes.length; offset += 1) {
      const mode = modes[(round + offset) % modes.length];
      samples.push({ round: round + 1, mode, ...await measure(sessions.get(mode), mode) });
    }
  }
} finally {
  for (const { context, profile } of sessions.values()) {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
  const path = join(output, 'samples.json');
  await writeFile(path, JSON.stringify({
    ...report,
    complete: samples.length === modes.length * rounds,
  }, null, 2) + '\n');
  console.log(path + ' (' + samples.length + ' samples)');
}
