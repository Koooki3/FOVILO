# Watch performance baseline

Run `npm run perf` for a fixed Watch fixture. The only response is a small synthetic HTML page served at the same origin and path as the real Watch page. Run `npm run perf -- --live` for the signed-out public YouTube video. Both use Playwright Chromium and the actual built MV3 package.

Each run creates fresh profiles for native Chromium, FOVILO installed and disabled through its popup, and FOVILO enabled. It warms each profile with one navigation, then opens the same URL six times per state. State order rotates between rounds. Each sampled tab returns to `about:blank` before the next profile is sampled, stopping the previous page's playback and background work. The observer stops about 1.5 seconds after DOMContentLoaded. The test checks page visibility and expects one control only when FOVILO is on. A partial run is labeled incomplete.

Raw samples, browser and OS versions, viewport and build hashes are written to `work/perf-fixture/samples.json` and `work/perf-live/samples.json`. The measurement includes navigation-to-DOMContentLoaded, the latest LCP candidate in the window, shifts without recent user input, long task counts and CDP renderer duration deltas after DOMContentLoaded. Treat the shift sum as a windowed diagnostic. Interpret task timings as combined renderer work and omit invalid deltas. The sample does not identify individual extension tasks.

This baseline covers startup in headless Chromium. Longer interactions, final Core Web Vitals, INP, background behavior, real-device traces and high-refresh performance still need dedicated runs. Use the raw samples to check variation before interpreting differences between modes. The fixture only checks that instrumentation and extension states work under repeatable conditions.

## 2026-11-12 first baseline

Windows, Intel Core i7-13650HX, Chrome for Testing 145.0.7632.6, 1280×800, six samples per state. The unminified content script was 9,365 bytes. For the fixture, the median LCP candidates were 22 ms native, 24 ms off and 22 ms on. Each fixture sample reported zero long tasks.

The first live probe used reloads while other test profiles could still be playing YouTube. Part of that run overlapped a fixture run. It prompted the switch to blanking profiles between samples and running the fixture and live measurements sequentially. The original raw probe is retained locally as `work/perf-live/overlap.json`.

The sequential live run yielded the following medians and observed ranges in milliseconds.

| State | DOMContentLoaded | LCP candidate | Renderer task duration after DOMContentLoaded |
| --- | ---: | ---: | ---: |
| Native | 1,248 (1,016–1,995) | 1,580 (1,472–3,480) | 1,107 (1,069–1,318) |
| FOVILO off | 1,250 (1,107–2,021) | 1,572 (1,452–3,532) | 1,095 (1,053–1,290) |
| FOVILO on | 1,219 (1,134–1,996) | 2,144 (1,428–3,424) | 1,097 (1,032–1,166) |

The enabled median LCP candidate was 564 ms above native in this run. The ranges overlap and the measured renderer task medians were close. The startup performance gate stays open. Capture candidate identity and browser timeline traces in a larger repeat run before attributing the difference or setting a release claim.
