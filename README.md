# FOVILO

[简体中文](README.zh-CN.md)

FOVILO is an experimental Chromium extension for desktop YouTube. The first Watch control copies a link to the current time. **Return to YouTube** removes the control and saves the global off setting. Use the extension popup to turn it back on or disable Watch controls separately.

Everyday emphasizes the video title, channel and metadata in the native Watch layout. Its controls follow YouTube's light or dark appearance.

![Live YouTube recording showing time-link feedback and the restored page while playback continues](docs/media/watch-demo.gif)

See the [enabled and restored views](docs/RELEASE_MATERIALS.md#watch-development-preview) and the capture details. Film excerpt © 2008 Blender Foundation, [CC BY 3.0](https://peach.blender.org/about/).

## Try the development build

1. With Node.js 24, run `npm ci` and `npm run build` from the `dev` checkout.
2. Open `chrome://extensions`, enable Developer mode and choose **Load unpacked**. Select the generated `dist` folder.
3. Reload an existing desktop YouTube tab, then open a regular video. The control appears below the player when the Watch adapter recognizes the page.

The extension stores two preferences locally and runs its content script on `https://www.youtube.com/*`. Copying requires a user action. The build has no telemetry or extension service.

If the browser blocks clipboard access, FOVILO shows the link in a selectable field. On the Watch page, **Return to YouTube** returns keyboard focus to the native video title when focus is still on the FOVILO controls.

## Development

Run `npm run typecheck`, `npm run lint` (manifest policy), and `npm test`. For the browser fixture, install the browser with `npx playwright-core install chromium --no-shell` and run `npm run test:browser`. See the [verification matrix](docs/QA_MATRIX.md) and [release material plan](docs/RELEASE_MATERIALS.md).

Run `npm run test:live` separately when the test browser can reach YouTube. It uses a fresh signed-out profile and a public Blender video.

See the [performance baseline](docs/PERFORMANCE_BASELINE.md) for startup and time-link feedback measurements.

FOVILO is a working name. This project is independent of YouTube and Google.
