# Chrome Web Store listing draft

Working name **FOVILO**. The proposed category is **Functionality & UI** because the extension adds controls to the desktop YouTube interface. English is the default listing language, with a Simplified Chinese listing from the bundled `zh_CN` locale. Finalize the name and confirm the category in the developer dashboard before submission. [Listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) · [Category guidance](https://developer.chrome.com/docs/webstore/best-practices#choose-your-extensions-category-well)

## English

**Short description**

Viewing modes, timestamp links and keyboard commands for desktop YouTube.

**Detailed description**

FOVILO adds a collapsible row of controls to desktop YouTube. On compatible watch pages, copy a link to the current playback time, hide side recommendations with Focus, or use Cinema to frame the inline player. Select the active mode again to return to Everyday.

Find available actions in Commands on Home, Watch and Search. On Search, switch to Compact results for tighter spacing. On Home, open YouTube's native Subscriptions page. You can assign a shortcut for Commands in Chrome's extension shortcuts settings.

Choose Return to YouTube to restore the native layout. The popup can turn FOVILO back on or switch the Home, Watch and Search controls independently. FOVILO is an independent extension for desktop YouTube.

## 简体中文

**简短说明**

为桌面版 YouTube 提供观看模式、时间链接和键盘命令。

**详细说明**

FOVILO 为桌面版 YouTube 添加一排可折叠控件。在兼容的播放页，你可以复制当前播放位置的链接，用专注模式隐藏侧边推荐，或用影院模式给原生播放器加上暗色边框。再次选择已启用的模式即可回到日常模式。

在首页、播放页和搜索页打开「命令」，可查找当前页面可用的操作。搜索页支持切换紧凑结果，首页可打开 YouTube 原生订阅页。也可以在 Chrome 的扩展快捷键设置中为「命令」分配按键。

选择「恢复原生 YouTube」即可恢复原生布局。通过扩展弹窗可以重新启用 FOVILO，也可以独立开关首页、播放页和搜索页控件。FOVILO 是一款独立的桌面版 YouTube 扩展。

## Privacy and reviewer fields

| Field | Draft |
| --- | --- |
| Single purpose | Improve desktop YouTube viewing and navigation by adding local, page-specific controls while retaining the native player. |
| `storage` | Save and read the user's global, Home, Watch and Search switches in browser-local extension storage. |
| `https://www.youtube.com/*` | Run the content script on desktop YouTube to detect supported Home, Watch and Search routes, place controls beside native content and read the video position when the user requests a timestamp link. The route can change within the same document, so the match covers the desktop YouTube origin. |
| Remote code | Extension code is bundled with the package. The extension initiates no network requests and sends no telemetry. |
| Data handling | The page URL, layout state and video time are processed in the browser. FOVILO writes a timestamp link to the clipboard when requested, or shows it for manual copying if writing is denied. Review dashboard declarations against the exact upload and the public [privacy notice](../PRIVACY.md). |

These fields describe the current [manifest](../public/manifest.json), [local settings](../src/settings.ts) and [content script](../src/content.ts). Before submitting, confirm a public privacy-policy URL reachable while signed out and recheck the final package and disclosures. [Privacy field guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

To reproduce the core flow, open a supported public video, play it, select **Cinema**, then **Copy time link**. Verify the timestamp and select **Return to YouTube**. Open the popup to re-enable FOVILO. [Live preview and attribution](RELEASE_MATERIALS.md#watch-development-preview)

## Store media checklist

| Asset | Draft status |
| --- | --- |
| 128 × 128 PNG icon | [Design candidate](media/store/icon-candidate.png) with a transparent margin. Final approval and inclusion in the release manifest and ZIP are pending. |
| 1280 × 800 screenshots | [English](media/store/watch-en.png) and [Simplified Chinese](media/store/watch-zh-cn.png) show Cinema and timestamp-copy feedback in real signed-out Watch sessions. |
| 440 × 280 small tile and 1400 × 560 marquee | Optional. Prepare after the visual identity is settled. |
| Promotional video | Optional. The [18-second MP4](media/watch-walkthrough.mp4) is available for GitHub. The store field accepts a YouTube video URL. |

The screenshots were taken on 2026-11-12 with commit `fc37cb2`, Chrome for Testing 145.0.7632.6 on Windows, and a 1280 × 900 source viewport. Each uses an 896 × 560 crop of the native page, resized to 1280 × 800 RGB PNG. The crop omits recommendations and keeps the native player controls, selected Cinema button, timestamp feedback and recovery action. The footage is a cropped excerpt of *Big Buck Bunny*, © 2008 Blender Foundation / www.bigbuckbunny.org. [Film source](https://www.youtube.com/watch?v=aqz-KE-bpKQ) · [CC BY 3.0 attribution terms](https://peach.blender.org/about/) · [Store image specifications](https://developer.chrome.com/docs/webstore/images)
