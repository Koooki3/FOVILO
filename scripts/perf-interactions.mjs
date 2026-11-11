import assert from 'node:assert/strict';

export async function measureCopies({ page, context }, url, repetitions) {
  const videoUrl = new URL(url);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: videoUrl.origin });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => {
    const player = document.querySelector('#movie_player');
    const video = player?.querySelector('video.html5-main-video');
    return video && video.readyState >= 2 && Number.isFinite(video.duration) &&
      !video.seeking && !player.matches('.ad-showing, .ad-interrupting');
  });
  await page.locator('#movie_player video.html5-main-video').evaluate((video) => video.pause());

  const button = page.locator('[data-fovilo-watch]').getByRole('button', { name: 'Copy time link' });
  const samples = [];
  for (let index = 0; index < repetitions; index += 1) {
    await button.evaluate((button) => {
      const status = button.getRootNode().querySelector('[role=status]');
      window.foviloCopyProbe = new Promise((resolve) => {
        const cancel = new AbortController();
        let observer;
        const timer = setTimeout(() => {
          cancel.abort();
          observer?.disconnect();
          resolve(null);
        }, 5000);
        button.addEventListener('click', (event) => {
          if (!event.isTrusted) return;
          const input = event.timeStamp;
          const video = document.querySelector('#movie_player video.html5-main-video');
          const seconds = Math.floor(video.currentTime);
          observer = new MutationObserver(() => {
            observer.disconnect();
            const mutationMs = performance.now() - input;
            const feedback = status.textContent;
            requestAnimationFrame(() => requestAnimationFrame(() => {
              clearTimeout(timer);
              resolve({
                mutationMs,
                nextFrameMs: performance.now() - input,
                seconds,
                feedback,
              });
            }));
          });
          observer.observe(status, { childList: true, subtree: true, characterData: true });
        }, { capture: true, once: true, signal: cancel.signal });
      });
    });
    await button.click();
    const sample = await page.evaluate(() => window.foviloCopyProbe);
    assert.ok(sample, 'time-link feedback was not observed');
    assert.equal(sample.feedback, 'Time link copied.');
    const expected = new URL(url);
    expected.searchParams.set('t', sample.seconds + 's');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected.href);
    samples.push({ repetition: index + 1, ...sample });
  }
  await page.goto('about:blank');
  return samples;
}
