# Verification matrix

Run locally on Windows with Node 24.13.1 and Playwright Chrome for Testing 145.0.7632.6. The fixture routes desktop YouTube requests to synthetic local HTML and uses a generated silent media resource. It exercises the built MV3 extension in Chromium.

| Check | Scope |
| --- | --- |
| `npm run typecheck` | Strict TypeScript |
| `npm run lint` | MV3 declaration and permission allowlist |
| `npm test` | Canonical route parsing and timestamp links |
| `npm run test:browser` | Home → Watch SPA, clipboard, simulated ad state, stale media handoff, repeat events, history back, anchor and Watch root replacement, native node and comment draft preservation on global off |
| Live signed-out YouTube Watch | Passed one page on 2026-11-12. The copy action reported success, the control detached on global off, and the same native video element continued from 2.06 s to 6.34 s without pausing. [Preview and environment](RELEASE_MATERIALS.md#watch-development-preview) |
| Extended live scenarios | Pending. Ad transitions, captions, full screen, playlists, comments, multiple navigation paths and browser uninstall/reload |
| Visual, accessibility, performance and compatibility | Pending. Real screenshots, keyboard/focus/zoom, native/off/on trace, other browsers, devices and extensions |

For the live baseline, record browser, OS, hardware, viewport, locale, login state and navigation path. Repeat each matched native/off/on trial and retain the raw trace. Track startup, long tasks, layout and action responsiveness. Report both the conditions and run-to-run variance before drawing any performance conclusion.

Local build, typecheck, manifest policy, two unit tests and the Chromium fixture passed. Gate 0 remains open for live route baselines, competitor task trials and brand review. Gate 1 remains open for the extended live matrix.
