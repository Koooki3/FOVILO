# Verification matrix

Run locally on Windows with Node 24.13.1 and Playwright Chrome for Testing 145.0.7632.6. The fixture routes desktop YouTube requests to synthetic local HTML and uses a generated silent media resource. It exercises the built MV3 extension in Chromium.

| Check | Scope |
| --- | --- |
| `npm run typecheck` | Strict TypeScript |
| `npm run lint` | MV3 declaration and permission allowlist |
| `npm test` | Canonical route parsing and timestamp links |
| `npm run test:browser` | Home → Watch SPA, clipboard, simulated ad entry/exit (clipboard unchanged during the ad and time links restored afterward), stale media handoff, repeat events, history back, late/replaced Watch root and anchor, native node and comment draft preservation, and global and per-feature popup toggles |
| Live signed-out YouTube Watch | Passed one page on 2026-11-12. The copy action reported success, the control detached on global off, and the same native video element continued from 2.06 s to 6.34 s without pausing. [Preview and environment](RELEASE_MATERIALS.md#watch-development-preview) |
| `npm run test:live` | Passed on 2026-11-12. Live signed-out Home → Search → Watch → Search, browser Back/Forward, native fullscreen enter/exit, and global off after reload. This check needs network access and depends on the public search result, so it runs separately from fixture CI. |
| Live playlist and caption controls | Passed on 2026-11-12 via `npm run test:live`. Selected *Sintel* in the native playlist after *Big Buck Bunny*. The two clipboard links matched the respective video IDs and the 4 s and 12 s seek positions. The native caption button changed its pressed state with one FOVILO control mounted. [Public playlist](https://www.youtube.com/playlist?list=PLav47HAVZMjnTFVZL-aImCQIC0uLZtNCz) |
| Extended live scenarios | Pending. Naturally served ads, caption rendering and track selection, playlist autoplay, signed-in comments and browser uninstall/reload |
| Visual, accessibility, performance and compatibility | Pending. Real screenshots, keyboard/focus/zoom, native/off/on trace, other browsers, devices and extensions |

For the live baseline, record browser, OS, hardware, viewport, locale, login state and navigation path. Repeat each matched native/off/on trial and retain the raw trace. Track startup, long tasks, layout and action responsiveness. Report both the conditions and run-to-run variance before drawing any performance conclusion.

Local build, typecheck, manifest policy, two unit tests and the Chromium fixture passed. Gate 0 remains open for broader live baselines, competitor task trials and brand review. Gate 1 remains open for the extended live matrix.
