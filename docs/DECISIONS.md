# Decisions

## ADR-001 · Watch development slice

Use a static isolated MV3 content script on desktop YouTube so it is present for Home → Watch SPA transitions. Gate mounting on a unique Watch root matching the URL video ID and a unique metadata anchor. Use route signals, bounded root discovery, and observe the active root and its immediate parent for replacement. Keep the owned UI in a Shadow DOM host. Disable removes that host and cancels its callbacks. No native nodes are moved.

The first operation is a user-triggered timestamp link from the native media element. Canonical links contain only the video ID and whole seconds. On clipboard rejection, show a selectable link. The popup and page controls share local boolean keys for the global, Home, Watch and Search switches. Access scope is the manifest match plus the `storage` permission. [Chrome content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) · [Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage)

## ADR-002 · Promotion workflow

`D:/FOVILO` is the `main` worktree. `D:/FOVILO/dev` is the `dev` worktree. Integrate features and quality fixes in `dev`. Promote validated snapshots through review once required release checks pass. Capture release materials from the exact promoted build. Record source commit, browser, viewport and page state alongside each capture.
