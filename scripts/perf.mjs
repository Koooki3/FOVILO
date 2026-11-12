import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { measureCopies } from './perf-interactions.mjs';

const live = process.argv.includes('--live');
const captureTraces = process.argv.includes('--trace');
const captureInteractions = process.argv.includes('--interactions');
const keyboardCopy = process.argv.includes('--keyboard-copy');
const requestedRounds = process.argv.find((arg) => arg.startsWith('--rounds='));
const defaultVideo = 'aqz-KE-bpKQ';
const videoOption = process.argv.find((arg) => arg.startsWith('--video='));
const videoId = videoOption ? videoOption.slice('--video='.length) : defaultVideo;
assert.match(videoId, /^[\w-]{11}$/);
assert.ok(live || !captureInteractions, '--interactions requires --live');
assert.ok(!keyboardCopy || captureInteractions, '--keyboard-copy requires --interactions');
const url = 'https://www.youtube.com/watch?v=' + videoId;
const modes = ['native', 'off', 'on'];
const rounds = requestedRounds ? Number(requestedRounds.slice('--rounds='.length)) : 6;
assert.ok(Number.isInteger(rounds) && rounds >= 0 && rounds <= 30, 'rounds must be an integer from 0 to 30');
assert.ok(rounds > 0 || captureInteractions, '--rounds=0 requires --interactions');
const checkpointsMs = [1500, 3500];
const viewport = { width: 1280, height: 800 };
const output = resolve('work', live ? 'perf-live' : 'perf-fixture',
  videoOption ? videoId : '', keyboardCopy ? 'keyboard-copy' : rounds === 0 ? 'interactions' : '');
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
      const paint = { cumulativeShift: null, longTasks: null };
      const candidates = [];
      const observers = [];
      function observe(type, update) {
        if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
        const observer = new PerformanceObserver((list) => update(list.getEntries()));
        observer.observe({ type, buffered: true });
        observers.push((stop) => {
          update(observer.takeRecords());
          if (stop) observer.disconnect();
        });
      }
      observe('largest-contentful-paint', (entries) => {
        for (const entry of entries) {
          const element = entry.element;
          const owned = element?.getRootNode()?.host?.hasAttribute('data-fovilo-watch') ||
            element?.closest('[data-fovilo-watch]');
          const scope = !element ? 'unavailable' :
            owned ? 'fovilo' :
              element.closest('#movie_player') ? 'player' :
                element.closest('#above-the-fold') ? 'watch-metadata' : 'other';
          candidates.push({
            ms: entry.startTime,
            size: entry.size,
            tag: element?.localName ?? null,
            scope,
            hasResource: Boolean(entry.url),
          });
        }
      });
      observe('layout-shift', (entries) => {
        paint.cumulativeShift = (paint.cumulativeShift ?? 0) +
          entries.filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0);
      });
      observe('longtask', (entries) => { paint.longTasks = (paint.longTasks ?? 0) + entries.length; });
      window.readFoviloPerf = (stop) => {
        for (const flush of observers) flush(stop);
        if (stop) observers.length = 0;
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          dclMs: nav.domContentLoadedEventEnd,
          observedUntilMs: performance.now(),
          visibility: document.visibilityState,
          candidates: [...candidates],
          lcpMs: candidates.at(-1)?.ms ?? null,
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

  // Both checkpoints observe the same navigation, with the page untouched by user input.
  const started = performance.now();
  const checkpoints = [];
  for (const delay of checkpointsMs) {
    await page.waitForTimeout(Math.max(0, started + delay - performance.now()));
    const stop = delay === checkpointsMs.at(-1);
    const timings = await page.evaluate((stop) => window.readFoviloPerf(stop), stop);
    checkpoints.push({ delayAfterDclMs: delay, ...timings });
  }
  const timings = checkpoints.at(-1);
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
  return { checkpoints, hostCount, rendererMs };
}

async function captureTrace(session, name, run, extraCategories = '') {
  const { cdp } = session;
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,loading,blink.user_timing' + extraCategories,
    transferMode: 'ReturnAsStream',
  });
  const finished = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  try {
    return await run();
  } finally {
    await cdp.send('Tracing.end');
    const { stream } = await finished;
    assert.ok(stream);
    const file = await open(join(output, 'trace-' + name + '.json'), 'w');
    try {
      let chunk;
      do {
        chunk = await cdp.send('IO.read', { handle: stream });
        await file.writeFile(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'));
      } while (!chunk.eof);
    } finally {
      await file.close();
      await cdp.send('IO.close', { handle: stream });
    }
  }
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
  url, viewport, checkpointsMs, rounds,
  host: { platform: platform(), release: release(), cpu: cpus()[0]?.model, node: process.version },
  build, browsers: {}, samples, copyFeedback: [], tracedCopyFeedback: [],
};
if (captureInteractions) report.copyInput = keyboardCopy ? 'keyboard-default-permissions' : 'pointer-granted-permissions';
const copyRepetitions = captureInteractions ? 12 : 0;
const sessions = new Map();
try {
  for (const mode of rounds === 0 ? ['on'] : modes) {
    const session = await launch(mode);
    sessions.set(mode, session);
    report.browsers[mode] = session.browserVersion;
    if (rounds > 0) await measure(session, mode);
  }
  for (let round = 0; round < rounds; round += 1) {
    for (let offset = 0; offset < modes.length; offset += 1) {
      const mode = modes[(round + offset) % modes.length];
      samples.push({ round: round + 1, mode, ...await measure(sessions.get(mode), mode) });
    }
  }
  if (captureTraces && rounds > 0) {
    for (const mode of modes) {
      const session = sessions.get(mode);
      await captureTrace(session, mode, () => measure(session, mode));
    }
  }
  if (copyRepetitions) {
    const session = sessions.get('on');
    report.copyFeedback = await measureCopies(session, url, copyRepetitions, { keyboard: keyboardCopy });
    if (captureTraces) {
      report.tracedCopyFeedback = await captureTrace(
        session, 'copy', () => measureCopies(session, url, copyRepetitions, { keyboard: keyboardCopy, traceMarks: true }),
        ',input,latencyInfo',
      );
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
    complete: samples.length === modes.length * rounds &&
      report.copyFeedback.length === copyRepetitions &&
      report.tracedCopyFeedback.length === (captureTraces ? copyRepetitions : 0),
  }, null, 2) + '\n');
  console.log(path + ' (' + samples.length + ' startup samples, ' +
    report.copyFeedback.length + ' untraced and ' + report.tracedCopyFeedback.length + ' traced clicks)');
}
