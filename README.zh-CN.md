# FOVILO

[English](README.md)

FOVILO 是面向桌面 YouTube 的实验性 Chromium 扩展。点击 **恢复原生 YouTube** 会恢复原生布局并保存全局关闭状态。扩展弹窗可重新启用 FOVILO，也可分别控制首页、播放页和搜索页功能。

界面支持简体中文，按浏览器语言自动选择，其他语言回退到英文。日常模式会区分视频标题、频道和元数据的视觉层级，控件跟随 YouTube 的浅色或深色主题。

在支持的普通播放页，按 **专注** 可收起推荐，再按一次即可恢复。切换视频时会退出专注模式。

按 **影院** 可收起推荐，并为页面内的播放器加上暗色衬底。专注和影院只能启用一个，再按当前模式即可回到日常模式。

按 **播放页控件** 可折叠或展开上下文栏。在同一个 YouTube 页面会话内切换视频时，栏的状态会保留。两种状态下都可以使用 **恢复原生 YouTube**。

在搜索页，**紧凑结果** 可缩小普通视频结果之间的间距，并在宽屏上缩窄缩略图。再按一次恢复标准布局，搜索页的上下文栏也可折叠。

首页的 **首页控件** 可以折叠。点击其中的 **订阅** 会打开 YouTube 原生订阅页。

在首页、搜索页或播放页打开 **命令**，即可查找适用于当前页面的操作。方向键选择，Enter 执行，Esc 退出并恢复焦点。

**最近使用** 会列出最近选过、且在当前页面可用的命令。刷新 YouTube 或关闭标签页后，列表会清空。

如需自定义快捷键，可在 FOVILO 弹窗点 **键盘快捷键**，然后在浏览器的扩展快捷键页设置 **打开 FOVILO 命令面板**。安装后默认未绑定按键，输入框聚焦或原生全屏时不会打开面板。

![真实 YouTube 页面录屏，展示时间链接复制反馈，以及关闭控件后视频继续播放](docs/media/watch-demo.gif)

查看[启用与恢复对照](docs/RELEASE_MATERIALS.md#watch-development-preview)及录制环境。影片片段 © 2008 Blender Foundation，[CC BY 3.0](https://peach.blender.org/about/)。

## 试用开发版

1. 在 `dev` 工作树用 Node.js 24 运行 `npm ci` 和 `npm run build`。
2. 打开 `chrome://extensions`，启用开发者模式，选择 **加载已解压的扩展程序**，选中生成的 `dist` 文件夹。
3. 刷新已打开的桌面 YouTube 标签页，再进入普通视频。识别到兼容布局时，控件显示在播放器下方。

扩展只在本地保存全局和各页面的开关，内容脚本运行于 `https://www.youtube.com/*`。复制链接由用户主动触发。构建产物无遥测或扩展后端服务。

浏览器拒绝访问剪贴板时，FOVILO 会显示可选中的链接。关闭播放页控件时，如果键盘焦点仍在 FOVILO 内，焦点会回到 YouTube 原生视频标题。

## 开发

运行 `npm run typecheck`、`npm run lint`（Manifest 策略检查）和 `npm test`。浏览器夹具测试需先运行 `npx playwright-core install chromium --no-shell`，再运行 `npm run test:browser`。参见[验证矩阵](docs/QA_MATRIX.md)、[宣发物料计划](docs/RELEASE_MATERIALS.md)、[发布流程](docs/RELEASE_RUNBOOK.md)及[隐私说明](PRIVACY.md)。

测试浏览器能访问 YouTube 时，可单独运行 `npm run test:live`。该测试使用全新的无登录配置和 Blender 的公开视频。

启动性能和时间链接反馈的测量方法见[性能基线](docs/PERFORMANCE_BASELINE.md)。

FOVILO 是项目暂定名。本项目独立于 YouTube 和 Google。
