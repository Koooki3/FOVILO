# FOVILO

[简体中文](README.zh-CN.md)

FOVILO is an experimental Chromium extension for desktop YouTube. The first Watch control copies a link to the current time. **Return to YouTube** removes the control and saves the global off setting. Use the extension popup to turn it back on or disable Watch controls separately.

![Live YouTube recording showing time-link feedback and the restored page while playback continues](docs/media/watch-demo.gif)

See the [enabled and restored views](docs/RELEASE_MATERIALS.md#watch-development-preview) and the capture details. Film excerpt © 2008 Blender Foundation, [CC BY 3.0](https://peach.blender.org/about/).

## Try the development build

1. With Node.js 24, run `npm ci` and `npm run build` from the `dev` checkout.
2. Open `chrome://extensions`, enable Developer mode and choose **Load unpacked**. Select the generated `dist` folder.
3. Reload an existing desktop YouTube tab, then open a regular video. The control appears below the player when the Watch adapter recognizes the page.

The extension stores two preferences locally and runs its content script on `https://www.youtube.com/*`. Copying requires a user action. The build has no telemetry or extension service.

## Development

Run `npm run typecheck`, `npm run lint` (manifest policy), and `npm test`. For the browser fixture, install the browser with `npx playwright-core install chromium --no-shell` and run `npm run test:browser`. See the [verification matrix](docs/QA_MATRIX.md) and [release material plan](docs/RELEASE_MATERIALS.md).

FOVILO is a working name. This project is independent of YouTube and Google.
