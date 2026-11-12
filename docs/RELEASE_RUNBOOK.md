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

## Promotion and release

Use [QA results](QA_MATRIX.md), the [risk register](RISK_REGISTER.md) and the [master plan](MASTER_SPEC.md) to review the candidate. Finalize brand and source license, review third-party notices and store policy, and finish the release demo and preview graphics. Validate signed-in layouts, assistive technology, browser compatibility and the performance thresholds on the intended release build. Record the candidate commit, CI run, version, assets, checksum and rollback target before creating a release.

The development ZIP is for local testing. Production tags, GitHub Releases and store submissions follow gate approval and use the promoted source.
