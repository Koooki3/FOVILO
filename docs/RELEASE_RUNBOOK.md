# Release runbook

## Development sync

The [GitHub repository](https://github.com/Koooki3/FOVILO) uses `main` as its default branch and `dev` for ongoing work. Keep commits and CI checks in sync with `origin/dev`. Before changing either branch, compare its actual remote SHA and preserve remote-only changes. Promote to `main` after the candidate checks and release gates are closed.

## Build and check a development ZIP

In a clean checkout at the candidate commit, run the following with Node.js 24 and Python 3.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx playwright-core install chromium --no-shell
npm run test:browser
python3 scripts/package_chromium.py
```

On Windows, use `python` if that is the installed Python 3 command. The Chromium fixture builds the extension into `dist`. The packager writes a versioned development ZIP and SHA-256 file to `work/packages/`. It validates the root manifest and exact archive contents against the build. Repeat the build and packaging and compare hashes. Use `npm run test:live` separately with network access, and retain the build hash and test results for the exact candidate.

For a newer Chrome for Testing build, set `FOVILO_CHROMIUM_EXECUTABLE` to the path to its browser executable before running `npm run test:browser` and `npm run test:live`. Both suites launch disposable profiles. The default continues to use the browser installed by Playwright. [Chrome for Testing downloads](https://googlechromelabs.github.io/chrome-for-testing/)

## Manual release checks

Record the candidate commit, browser and OS versions, viewport, language and login state. Save the observed outcome and enough context to repeat each check. Keep account details and private activity out of shared evidence.

| Scenario | Pass condition |
| --- | --- |
| Edge with an isolated profile | Load the extracted package through the extensions manager. Confirm the popup, copy a timestamp, switch Cinema on and off, then remove FOVILO and reload Watch. The native title and player remain usable and the rail is absent. [Edge sideloading](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading) |
| Signed-in Home and Watch | Navigate from the personalized feed to a regular video and back. Check for one rail per supported page, normal playback, and an intact native comment editor. Type a disposable draft without posting it and verify it remains after returning to the native layout. |
| Screen reader | With the reader's speech viewer or announcement history, check launcher names, dialog focus on open and close, the copied-link status, and the selectable link after clipboard refusal. Confirm that the focused control and announced result agree. |
| Naturally served ad and visible captions | On a session that serves an ad, verify that FOVILO leaves ad controls available and timestamp copy returns for the content. On a video with visible cues, compare native caption rendering with FOVILO enabled and disabled using the same track and time range. Record the outcome as inconclusive if the ad or cues never appear. |

## Promotion and release

Use [QA results](QA_MATRIX.md), the [risk register](RISK_REGISTER.md) and the [master plan](MASTER_SPEC.md) to review the candidate. Finalize brand and source license, review third-party notices and store policy, and finish the release demo and preview graphics. Validate signed-in layouts, assistive technology, browser compatibility and the performance thresholds on the intended release build. Record the candidate commit, CI run, version, assets, checksum and rollback target before creating a release.

The development ZIP is for local testing. Production tags, GitHub Releases and store submissions follow gate approval and use the promoted source.
