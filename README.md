# FOVILO

[简体中文](README.zh-CN.md)

FOVILO is an experimental Chromium extension for desktop YouTube. **Return to YouTube** restores the native layout and saves the global off setting. Use the extension popup to re-enable FOVILO or toggle the Home, Watch and Search controls independently.

Everyday emphasizes the video title, channel and metadata in the native Watch layout. Its controls follow YouTube's light or dark appearance.

Choose **Focus** on a supported video to hide the recommendations beside it. Choose **Focus** again to restore them. Focus resets when the video changes. The control is available on regular Watch pages with a supported recommendations area.

Choose **Cinema** to hide recommendations and add a dark frame around the inline player. Focus and Cinema are mutually exclusive. Select the active mode again to return to Everyday.

Use **Watch controls** to collapse or reopen the Context Rail. FOVILO remembers the choice while navigating within the current YouTube page session. **Return to YouTube** is available in either state.

On Search, **Compact results** reduces spacing between regular video results and narrows wide thumbnails. Select it again for the standard layout. Search controls can also be collapsed.

On Home, **Subscriptions** opens YouTube's native subscriptions page from the collapsible **Home controls** rail.

Select **Commands** on Home, Search or Watch to find actions for that page. Use the arrow keys to move through matches, Enter to run a command and Esc to close the dialog and restore focus.

To assign your own shortcut, open the FOVILO popup, choose **Keyboard shortcuts**, and set **Open FOVILO Commands** in the browser's extension shortcuts page. The shortcut starts unassigned. It leaves focused text fields and native fullscreen alone.

![Live YouTube recording showing time-link feedback and the restored page while playback continues](docs/media/watch-demo.gif)

See the [enabled and restored views](docs/RELEASE_MATERIALS.md#watch-development-preview) and the capture details. Film excerpt © 2008 Blender Foundation, [CC BY 3.0](https://peach.blender.org/about/).

## Try the development build

1. With Node.js 24, run `npm ci` and `npm run build` from the `dev` checkout.
2. Open `chrome://extensions`, enable Developer mode and choose **Load unpacked**. Select the generated `dist` folder.
3. Reload an existing desktop YouTube tab, then open a regular video. The control appears below the player when the Watch adapter recognizes the page.

The extension stores the global and page switches locally and runs its content script on `https://www.youtube.com/*`. Copying requires a user action. The build has no telemetry or extension service.

If the browser blocks clipboard access, FOVILO shows the link in a selectable field. On the Watch page, **Return to YouTube** returns keyboard focus to the native video title when focus is still on the FOVILO controls.

## Development

Run `npm run typecheck`, `npm run lint` (manifest policy), and `npm test`. For the browser fixture, install the browser with `npx playwright-core install chromium --no-shell` and run `npm run test:browser`. See the [verification matrix](docs/QA_MATRIX.md) and [release material plan](docs/RELEASE_MATERIALS.md).

Run `npm run test:live` separately when the test browser can reach YouTube. It uses a fresh signed-out profile and a public Blender video.

See the [performance baseline](docs/PERFORMANCE_BASELINE.md) for startup and time-link feedback measurements.

FOVILO is a working name. This project is independent of YouTube and Google.
