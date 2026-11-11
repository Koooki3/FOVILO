# FOVILO — YouTube Experience Extension

> **项目研究、同生态位异构设计、对抗性审查与 Agent 总管执行提示词（独立立项版）**  
> **研究基准日**：2026-11-11（Asia/Singapore）  
> **版本**：Strategy / Architecture / Execution Brief v1.0  
> **定位**：新建开源浏览器扩展；优先 Chrome / Edge（Manifest V3），然后 Firefox；以全球用户为首要设计对象。  
> **品牌状态**：`FOVILO` 仅作为本次方案的**暂定项目代号**。它并非经商标/域名/商店完整检索后确认可用的品牌；公开发布前必须完成正式查重并允许更名。

---

## 0. 一页决策摘要

**一句话**：不是“把 Bilibili MARGIN 换成 YouTube 版”，而是独立开发一个尊重 YouTube 原生播放能力、以设计系统与交互连续性为核心的浏览体验层（Experience Layer）。

**产品使命**：让 YouTube 在不牺牲原有能力的前提下，变得更有秩序、更灵动、更专注、更美观，也更能适应不同观看意图。

**选择的战略路径**：

1. **同一性原理**：抓住 MARGIN 的可迁移核心——“原生内容能力不变，重新组织感知、导航与交互”；不移植其样式或直接复制其实现。
2. **异构架构**：采用 *Progressive Enhancement + Native DOM Preservation + Capability-based Adapters*，默认不接管整个 YouTube 页面，不复制数据/评论/播放器协议。
3. **独立审美**：建立 `FOVILO Design Language`；把视觉品质放在版式、信息层级、动效语法、状态反馈和自适应体验上，而不是叠加玻璃/着色器特效。
4. **性能先行**：CSS-first、按路由及功能加载、最小 MutationObserver 作用域、低成本动画、按需激活的图形特效；所有性能声明须有可复现证据。
5. **可逆可信**：全局关闭、页面级关闭、单功能关闭、故障自动降级、恢复原生 DOM；默认本地存储、最小权限、禁遥测。
6. **工程闭环**：Agent 总管负责规划、分工、实现、测试、独立复核、Release 和持续回归；每阶段有证据及阻断条件。

**最重要的差异化判据**：如果关闭所有动效，产品仍应凭信息架构、可读性、状态反馈、功能可发现性和稳定性明显优于普通样式插件；否则设计还没有完成。

---

## 1. 参考项目 MARGIN：事实、价值和边界

### 1.1 已查看的资料与证据范围

对公开仓库 [jiuyang5354/bilibili-margin](https://github.com/jiuyang5354/bilibili-margin) 进行了源码级定向阅读，覆盖：

- `README.en.md`、`LICENSE`、`PRIVACY.md`、`package.json`、`public/manifest.json`；
- `src/content/main.ts`、`src/content/ui/shell.ts`、`src/content/ui/liquid-glass.ts`、`src/content/ui/command-palette.ts`；
- `src/content/bg/background.ts`、`src/background/sw.ts`；
- `docs/design-references.en.md`、`docs/performance-2026-11-07.md`；
- `docs/superpowers/specs/2026-11-03-youtube-home-style-design.md`；
- 部分近期提交、Issues，以及递归文件树。

查看时 `main` 的包配置/Manifest 标识版本为 `0.60.41`（以 2026-11-11 读取结果为准）。**此处是仓库静态审查，不等同于在真实账号、真实硬件、全部浏览器上完成端到端实测。** 某些性能数据来自该项目自己记录的测试，应视为项目方实验报告，非独立重测结果。

### 1.2 MARGIN 真正值得学习的设计思想

| 维度 | 可核实的做法 | 本项目应该汲取的原则 | 不应直接移植的部分 |
|---|---|---|---|
| 产品定位 | 保留 Bilibili 原生播放器、评论、清晰度，重排视觉与交互 | **保持原生行为契约**，重设计内容外围体验 | Bilibili 特定 DOM/API、弹幕和业务语义 |
| 视觉语言 | 编辑式版式、主题、液态玻璃、动态背景 | 从“视觉风格”上升到“视觉语法”与信息层级 | 同款按钮、背景、字体组合、玻璃位移贴图 |
| 页面架构 | TypeScript/CSS、Shadow DOM 外壳、按路由模块加载 | 隔离 UI、分模块加载、避免一次性注入全部业务 | 将整个站点接管逻辑原样搬到 YouTube |
| 交互 | 命令面板、抽屉、快捷入口、悬浮预览、可逆操作 | 高密度操作仍需可发现性、键盘可达、连续反馈 | 两栏面板的布局细节、具体 morph 动画 |
| 性能 | 可见性暂停、渲染降档、高刷时间基准、减少重复 DOM 扫描 | 帧预算与动态降级、基线-回归机制 | 以粒子数/Shader 数量代替真实用户体验 |
| 隐私 | 本地存储、可选外部服务、隐私说明 | Permission minimization、opt-in、可审计数据流 | 复制其已有外部网络或身份验证逻辑 |
| 维护 | 多类自动化测试、性能文档、提交及 Issues 驱动修复 | 测试证据和可复现问题闭环 | 追求功能覆盖面而过早扩大维护面积 |

### 1.3 源码级观察

**A. 入口与路由加载**  
`src/content/main.ts` 负责早期注入、设置读取、路由判定、页面模块按需 import，并对特定页面采取隐藏原版/重建外壳的策略。其优点是页面分块和统一入口；潜在成本是原生站点结构与重建布局之间的耦合、启动失败后的还原复杂度、FLash/FOUC 及页面切换生命周期竞争。YouTube 是频繁局部导航的 SPA，不能把这一策略当默认答案。

**B. 公共 PageShell**  
`ui/shell.ts` 以 Shadow DOM、共享顶部导航、设置、抽屉、背景、命令面板等组件形成统一 shell。这说明它不仅在做“换皮”，而是有可复用的信息架构。我们应继承**设计一致性原则**，但把共享层做成页面保留式增强，而非全站强制接管。

**C. Liquid Glass**  
`ui/liquid-glass.ts` 使用尺寸相关的位移图、Canvas 生成、SVG filter 和 `backdrop-filter` 组合；代码注释与 credits 指出它参考/移植了外部视觉组件。重要启示：精美细节需要真实材质与尺寸约束，但多层滤镜成本高、兼容性强依赖平台，并不适宜成为全页面的默认底层渲染。FOVILO 应当重做材质系统，并以**有意义的状态层和局部高光**代替“全站玻璃化”。

**D. 背景调度**  
`bg/background.ts` 使用 WebGL（部分效果引入 WebGPU），按页面可见性暂停，针对慢设备或覆盖场景降低绘制频率，并考虑高刷新率与 reduced-motion。值得学习的是**时基、调度与降级**，不是某个背景算法。

**E. 命令面板**  
`ui/command-palette.ts` 实现搜索、命令分类、快捷键、键盘操作和变形反馈。产品价值来自“低摩擦访问高频操作”，但具体视觉形式及其参考来源不应照搬。

**F. 浏览器能力与安全边界**  
Manifest 使用 MV3、`storage`、特定域权限及部分 MAIN-world 内容脚本。针对新项目，MAIN world 是特殊能力而不是默认环境；任何跨执行世界桥接都必须有可证伪的必要性、最小消息协议和审计。

### 1.4 从 Issues / 性能记录得到的反向经验

从公开问题与修复提交，可观察到如下**问题类型**，但不能据此断言当前版本一定仍有缺陷：

- 评论发送慢时发生重复提交：说明**幂等性、原生行为保留、请求完成状态**比反馈动画更重要（参考 [#165](https://github.com/jiuyang5354/bilibili-margin/issues/165) 及相关修复提交）。
- 用户区分不出标题与作者：说明视觉统一不等于视觉扁平，必须设计**语义层级与对比度**（参考 [#157](https://github.com/jiuyang5354/bilibili-margin/issues/157)）。
- Firefox 输入行为差异：说明跨浏览器测试不能用单一 Chromium 冒充（参考 [#150](https://github.com/jiuyang5354/bilibili-margin/issues/150)）。
- 圆角设置作用不一致：说明设计 token 必须有**作用域和组件契约**（参考 [#149](https://github.com/jiuyang5354/bilibili-margin/issues/149)）。
- 导航、自定义布局、暗/亮切换动效的意见：说明所谓“全局精致”必须以用户的高频路径验证，不能靠首屏截图证明。

`docs/performance-2026-11-07.md` 特别值得学习其**证据纪律**：明确将模拟刷新率、真实浏览器布局读数、软件渲染环境和未验证项分开；不把某一固定夹具的工作量改进换算为全站提速，也不声称已验证真实高刷 GPU。FOVILO 需要达到同等甚至更严格的证据透明度。

### 1.5 MARGIN 的 YouTube 风格方案说明了什么

MARGIN 仓库中存在一份 `2026-11-03-youtube-home-style-design.md`：它是**在 Bilibili 内新增可选的 YouTube 式布局模式**，不是一个 YouTube 扩展。我们应把这一观察作为边界提醒：**“将 A 的布局应用于 B”不等于“围绕 B 的需求从头设计”。** FOVILO 应从 YouTube 的任务、媒体类型和用户意图开始，不能反过来复制 MARGIN 的布局骨架。

### 1.6 知识产权策略

MARGIN 主仓库使用 MIT 许可证，MIT 允许合理条件下的使用、修改与发布，但要求对实际复制或实质性使用的代码保留版权与许可声明；第三方图标、字体、图片及改编组件另有条款。**不要把“尽量减少引用”误解为“复制后删掉署名”。**

本项目执行原则：

- 只吸收**抽象的交互原则、研究问题、性能经验、用户需求**；从零构建自己的组件、图标、品牌、token、动效和适配器。
- 避免源码复制、近似复刻 UI、搬运图形资源、直接改名复用特效实现。
- 若确实采用某第三方源码/资产，先确认权利与许可，登记 `THIRD_PARTY_NOTICES.md` 和 SBOM，满足归属/再分发条件。
- 不应凭相同功能本身判定侵权，但必须审查具体表达、代码和资源的实质性相似性；法律问题由适当专业人员复核。

---

## 2. YouTube 同生态位开源项目与竞品格局

以下是针对公开资料的**功能、架构及借鉴价值**整理；没有完成全量源码静态安全审计，也不声称所有特性在所有 YouTube 页面可用。

| 项目 | 定位及已公开的代表能力 | 可借鉴之处 | 我们的差异化边界 |
|---|---|---|---|
| [Kempt for YouTube](https://github.com/remonilo/kempt-yt) | 视觉统一、观看页标签、订阅时间线、侧栏集合、字体/强调色、独立功能开关、11 种语言 | CSS-first、轻依赖、模块化功能注册、单功能热关闭、谨慎处理 YouTube DOM | **最直接的竞品**；不能仅以“更漂亮的 Kempt”立项 |
| [YouTube Enhancer](https://github.com/YouTube-Enhancer/extension) | 大量播放/布局快捷增强，例如自动影院模式、字幕、自动播放、侧栏隐藏、时间戳预览等 | 功能场景矩阵、偏好设置、播放控制边界 | 不做 80 个无主线开关；聚焦体验逻辑与设计体系 |
| [YouTube Minimalist](https://github.com/isaacyauk/Youtube-Minimalist) | 减少推荐、隐藏干扰、订阅优先、限制无意识刷视频 | 注意力管理、清晰的“专注模式”目标 | 不把克制变成一刀切禁用；用户可以一键恢复 |
| [Unhooked 开源实现](https://github.com/Havockeyan/UnhookYoutube-opensource) | 按页面区域隐藏推荐、Shorts、评论、侧栏等 | 选项映射、区域开关、可测试规则 | 不复制原扩展商标和功能面板；以模式组合减少复杂度 |
| [SponsorBlock](https://github.com/ajayyy/SponsorBlock) | 社区标注的视频片段跳过 | 可逆控制、状态预告、社区数据经验 | 不作为首发核心；若集成需遵循 GPL 与服务协议 |
| [DeArrow](https://github.com/ajayyy/DeArrow) | 社区改进标题/缩略图；提供查看原始内容入口 | “更忠实的信息表达”、可逆展示、透明来源 | 不直接复制标题/缩略图处理与服务端逻辑 |
| [Return YouTube Dislike](https://github.com/Anarios/return-youtube-dislike) | 补回估算 dislike；公开 API 及限制 | 数据来源说明、不确定性展示、请求退避 | 非核心；避免为了数字而增加依赖和权限 |

**竞品结论**：现有产品已完成“统一视觉”和“播放功能增强”的基础答案。FOVILO 的核心命题应是：**如何把不同的观看意图（探索、学习、沉浸、回顾）映射为连续、一致、可切换的页面空间，而不是堆叠独立开关。**

### 2.1 推荐的生态层级

1. **L0：原生 YouTube**——媒体、登录、播放队列、评论、订阅、字幕和 YouTube 自己的交互逻辑。
2. **L1：FOVILO Experience Layer**——信息层级、布局、上下文轨道、交互反馈、注意力模式、可访问性与外观。
3. **L2：用户可选的辅助服务**——未来可加片段跳转、外部数据等，但必须明确权限、数据流、许可、降级。
4. **L3：工具与扩展共存**——与 SponsorBlock、Return YouTube Dislike、其他扩展发生冲突时，优先不介入或让出原生 DOM 控制权。

**禁止**把 L1 冒充为完整独立视频客户端，也禁止以未经许可的抓取/协议逆向当作关键产品依赖。

---

## 3. 同一性原理：从不变核心推导异构创新

### 3.1 不变项（Invariants）

- 用户真正要的是**视频与其语境**，不是装饰容器。
- 用户在不同任务下对信息密度、注意力分配、探索效率的需求不同。
- 内容平台应始终拥有其原生行为的权威性：播放、暂停、清晰度、字幕、账户与评论等。
- 用户必须能理解当前状态、预测操作结果、撤销或恢复。
- 设计美感应服务于识别、操作、阅读与长时间舒适观看。
- 浏览器扩展只能在能力边界内尽力增强，而不能假定 YouTube DOM、实验特性和区域内容永久不变。

### 3.2 不应保留的表象（Contingencies）

- Bilibili 的信息结构、弹幕生态、收藏逻辑、用户卡片样式；
- 某组具体颜色、玻璃 refraction、Shader 种类、卡片圆角；
- 把整个原生页面先隐藏再重建的前提；
- 为了炫技而采用的持续渲染、复杂画布、全屏遮罩、每次导航入场动画；
- 按来源项目文件组织结构照搬模块。

### 3.3 新设计推导

由以上不变项推出：

**不是 Skin，而是 Adaptive Experience Composition（自适应体验编排）。**

它由四个核心子系统组成：

- **Intent Modes**：围绕“我来做什么”而不是“我想打开哪个开关”组织界面。
- **Context Rail**：在不同页面提供一致且可折叠的快捷上下文操作，不夺走原生导航控制。
- **Continuity Engine**：跨 SPA 导航维持焦点、交互状态、滚动位置与低干扰的运动连续性。
- **Design Runtime**：受性能预算约束的 token、motion、material 和降级机制。

这是一个**设计假说**，不应被宣称已经证明优于竞品。需要通过 A/B 任务与实机验证来证伪或支持。

---

## 4. 产品定义：FOVILO（暂定）

### 4.1 品牌定位

**工作名**：FOVILO  
**候选主张**：*YouTube, in a better frame.*  
**备选主张**：*Watch with intention.*  
**品牌气质**：editorial / tactile / confident / calm / responsive / global。  
**反面气质**：廉价霓虹、满屏玻璃、过饱和渐变、炫目 Intro、伪 macOS、整站赛博大改造。

品牌名称检查：本次初步公开网络检索尚未证明 `FOVILO` 对软件类别具有可用性；此外存在同名网站和其他领域使用。上线前必须检查 GitHub、Chrome Web Store、AMO、主流应用商店、相关域名、US/EU/SG 等目标市场商标数据库与同类软件的混淆风险。若不通过，立刻更名；**不得将“暂未搜索到同名插件”等同于法律许可。**

### 4.2 三种观看模式（初版）

| 模式 | 核心目标 | UI 行为 | 默认等级 |
|---|---|---|---|
| **Everyday** | 保持 YouTube 熟悉的使用方式，同时更清晰 | 原生页面布局微调、统一排版、精简控件、可见的上下文轨道 | 默认，最安全 |
| **Focus** | 长视频、学习、播客、写笔记 | 旁栏权重降低、评论和推荐按需展开、字幕/章节入口优先 | 用户主动切换 |
| **Cinema** | 沉浸观看，减少周边 UI | 玩家周围的空间重排、暗部背景、轻度过渡与快速恢复 | 用户主动切换 |

**原则**：模式是用户意图的显式选择，不是推断心理状态；不暗中自动更改用户偏好。每种模式均有 `Return to YouTube`，每个功能可以单独暂停。

### 4.3 新产品关键交互

#### A. Context Rail（上下文轨道）

- 不遮挡原生播放器；固定在可用侧边空间，狭屏自动收成紧凑入口。
- 根据路由显示相关功能：Home（布局/过滤/订阅）、Watch（模式/字幕快捷入口/时间链接/稍后看）、Search（密度与筛选）、Channel（导航及收藏快捷入口）。
- 展开状态由用户明确控制，初次使用提供克制的可关闭提示；不自动铺开大面积面板。
- 每次操作必须有即时、语义明确的反馈；不伪造“已保存到 YouTube”之类服务器成功态。

#### B. Command Surface（统一命令层）

- 支持键盘调用、命令搜索、最近使用，但与 YouTube 的现有快捷键不冲突；必须有可配置键位和焦点保护。
- 提供 Mode Switch、Toggle Rail、Copy Time Link、Open Native Page、Appearance、Settings 等真正有价值的命令。
- 主逻辑为命令注册表而非每页单独实现；支持可访问性标签、帮助和键盘退出。

#### C. Reading & Discovery Rhythm（探索节奏）

- 卡片标题 > 作者 > 辅助 metadata 的文字层级清晰；频道和推荐始终保持主体可辨。
- 支持舒适/紧凑密度，但不复制 Kempt 的界面分组或图标布局。
- 减少 hover 依赖；触摸、键盘和窄屏同样可用。
- 搜索结果强调可快速浏览性与语义一致性，而不是尽可能塞入更多内容。

#### D. Seamless Mode Morph（模式转换）

- 模式切换不重载视频、不丢播放进度、不重建播放器。
- 动画是信息结构连续变化的提示，而非每次切换都播放表演式动画。
- 在 `prefers-reduced-motion`、后台标签页、低性能设备上移除非必要动效。

### 4.4 第一版明确不做

- 不做独立 YouTube API 客户端、不抓取整站推荐数据、不要求登录 Google OAuth。
- 不改写原生播放器、不拦截并重放视频流、不规避广告/地区/会员访问限制。
- 不支持视频下载、后台音频破解或 DRM/付费限制绕过。
- 不在 MVP 中加入 AI 总结、云端账户、远程同步或用户行为追踪。
- 不将动态 Shader/复杂液态玻璃当作第一版核心卖点。
- 不为了展示“功能多”而扩展到 YouTube Music、Kids、Studio、移动站与所有嵌入页面；这些需要独立评估。

---

## 5. FOVILO Design Language：完整视觉与交互规格

### 5.1 设计哲学

1. **Content first**：视频封面、标题和播放器优先。
2. **Clarity through contrast**：所有信息有可见层级；减少同大小、同灰度、同字重的文本。
3. **Motion carries meaning**：动画解释状态变化、空间关系和反馈。
4. **Material with restraint**：材质服务于视觉分层，而非制造大量透明覆盖。
5. **Personality without noise**：具有辨识度，但不增加认知负担。
6. **Global by default**：英文优先设计并考虑多语言文本扩张、RTL、读屏、键盘与高对比需求；中文翻译同时验证。

### 5.2 视觉 token（提议初值，必须经过原型与实测校准）

```css
:root[data-fovilo-theme='light'] {
  --fv-bg: #F6F6F3;
  --fv-surface: #FFFFFF;
  --fv-surface-raised: #FBFBF9;
  --fv-ink: #191B1B;
  --fv-ink-secondary: #656A6A;
  --fv-line: #E3E6E4;
  --fv-accent: #496A65;
  --fv-focus: #2467C7;
  --fv-radius-sm: 10px;
  --fv-radius-md: 16px;
  --fv-radius-lg: 24px;
  --fv-space-1: 4px;
  --fv-space-2: 8px;
  --fv-space-3: 12px;
  --fv-space-4: 16px;
  --fv-space-6: 24px;
  --fv-space-8: 32px;
}
:root[data-fovilo-theme='dark'] {
  --fv-bg: #111415;
  --fv-surface: #1B1F20;
  --fv-surface-raised: #232829;
  --fv-ink: #F1F3F1;
  --fv-ink-secondary: #A9B0AF;
  --fv-line: #343A3B;
  --fv-accent: #A3C9B7;
  --fv-focus: #90B9FF;
}
```

说明：这是**独立构造的示例参数**，不应直接据此声称 WCAG 达标。需在实际文本、背景、透明度、图标和状态下完成对比度测量。YouTube 原生页面不一定允许简单地在根节点应用这些 token；正式实现应在扩展自己的 Shadow Root 或作用域内使用，避免污染原生 CSS。

### 5.3 排版与图标

- 英文正文选择许可明确、字形成熟的 Sans（例如 Inter / Geist 等可评估），大标题可辅以具有品牌特色的 display face，但避免模板化的过度混搭。
- 不通过粗体覆盖所有内容；标题 500–650、辅助文字 400–500、控制说明适度更轻。
- 图标单一几何逻辑（统一线宽、光学补偿、角度、stroke-cap），**从独立语义清单重绘/使用许可明确的图标库**，不沿用 MARGIN 或 Kempt 的图标集。
- 不把图标单独当导航：必要功能有 tooltip、文字标签或新手可发现机制。

### 5.4 动效系统（示意预算，非“越快越好”）

| 交互场景 | 动作语义 | 建议时长 | 性能边界 |
|---|---|---:|---|
| 按下、hover、状态确认 | 即时反馈 | 70–150 ms | opacity / transform 优先 |
| 小菜单、Tooltip、Chip | 局部出现 | 140–220 ms | 避免反复同步布局读取 |
| Rail 展开、Sheet 打开 | 空间转移 | 220–360 ms | 优先 compositor-friendly，保留焦点 |
| Mode 切换 | 状态之间的连续映射 | 260–420 ms | 不替换播放器，不阻断输入 |
| 页面导航连续性 | 导航定位而非铺满屏特效 | 按场景 | 不额外延迟原生交互完成 |

规则：

- 动画有 `enter / stable / exit / interrupted / reduced` 状态；快速反向切换不得留下 DOM、焦点或定时器泄漏。
- 同时存在的动效以用户操作反馈为最高优先级；decorative motion 可推迟或取消。
- 只允许**局部、短时、低面积**的玻璃折射或光学特效；普通卡片以实底和适度层次为默认。
- 支持高刷屏幕自然 rAF 时基；不通过人为固定 60fps 制造不均匀节拍，不以模拟 rAF 证明物理屏幕 FPS。
- 系统 reduced-motion 下，空间位移动画应降为简单且快速的状态变化，并完整保留功能反馈。

### 5.5 响应式 / 无障碍

- 重要宽度：`320 / 375 / 768 / 1024 / 1280 / 1440 / 1920`；支持 200% 缩放、窄视口、长标题。
- 宽屏允许 Rail；中屏压缩侧栏；窄屏降级为 action button / menu；不强行占据视频宽度。
- UI 不应截断用户当前键盘焦点；Dialog 有正确焦点管理、Escape 关闭、返回原焦点。
- 对照 WCAG 2.2 AA 设计并测试：文本/非文本对比、键盘、焦点可见、目标尺寸、动态内容提示、缩放、读屏语义。
- 国际化覆盖字符串外部化、ICU/复数、日期格式、非拉丁字符和 RTL 基础设施；初期优先英语与简体中文，逐步扩展。

---

## 6. 技术架构：同生态位异构实现

### 6.1 关键架构抉择

**基准架构：**

- `Manifest V3 + TypeScript + Vite + CSS Custom Properties + Native DOM/Shadow DOM`。
- Content layer 默认运行在 **ISOLATED world**；仅当证据说明必要时才引入严格限制的 MAIN-world bridge。
- 新增 UI 采用 Shadow DOM 隔离；对于 YouTube 原生元素，只进行小范围重排或增量装饰（并记录 ownership）。
- **默认不拦截原生请求、不代理账号 API、不覆盖 `fetch`/XHR、不替换播放器、不把 YouTube 原生 UI 全部 `display:none` 再重建。**
- Background service worker 保持轻量，处理设置与必要消息；除用户明确启用的功能外不持续唤醒。
- MVP 不引入 React/Vue。若后续仅某个复杂设置页需要框架，单独 ADR 论证 bundle、维护成本、可测试性。

核心信念：**对 YouTube 的浏览器扩展而言，最大的技术风险通常不是画不出新 UI，而是破坏复杂的原生生命周期和功能语义。**

### 6.2 渐进增强分层

```text
Chrome / Edge / Firefox
       |
Manifest V3 / Extension Permissions
       |
Content Bootstrap  [早期轻量启动、开关、能力检测]
       |
Route & Lifecycle Kernel
       |  (generation id / navigation epoch / AbortController / disposal)
       v
YouTube Capability Adapters
       |-- HomeAdapter
       |-- WatchAdapter
       |-- SearchAdapter
       |-- ChannelAdapter
       |-- SubscriptionsAdapter
       |-- ShortsAdapter (later)
       |
       +---- Native Ownership Registry [只记录本扩展确实移动/创建的节点]
                         |
                    Experience Runtime
                    |-- Tokens / Theme / Contrast
                    |-- Motion / Reduced Motion
                    |-- Mode State Machine
                    |-- Context Rail
                    |-- Command Registry
                    |-- Feature Registry
                    |-- Feature Flags / Circuit Breaker
                         |
                    QA Telemetry (LOCAL DEV ONLY)
                    Unit / Contract / E2E / A11y / Perf / Visual
```

### 6.3 生命周期契约

每个功能必须实现：

```ts
interface FeatureContext {
  signal: AbortSignal;
  route: RouteInfo;
  capabilities: Readonly<CapabilitySet>;
  settings: Readonly<Settings>;
}

interface Feature {
  id: string;
  enabledByDefault: boolean;
  canMount(ctx: FeatureContext): boolean;
  mount(ctx: FeatureContext): Promise<(() => void) | void> | (() => void) | void;
}
```

运行约束：

1. 每次导航分配新 `navigationEpoch`；过期异步结果不能写入当前页面。
2. 同一功能在同一容器上必须**幂等挂载**。
3. 卸载时清理观察器、事件监听、rAF、超时、样式、注入节点与必要的原生位置恢复。
4. 原生节点移动使用明确标记、original parent/nextSibling 引用和还原测试；不能直接 clone 对应交互功能。
5. 先检测原生 DOM 能力，再实施增强；缺少锚点时 `skip + degraded state`，不能破坏页面。
6. 非必要增强失败后，原生播放、导航和评论依然可以操作。
7. 不能无限循环等待节点，禁止页面级永久高频 MutationObserver；观察者必须限域、限时、可断开。
8. SPA 导航至少覆盖：链接点击、浏览器返回/前进、同页视频切换、播放列表下一集、历史页面恢复。

### 6.4 路由与逐步覆盖顺序

- **MVP Phase 1**：`/`（Home）、`/watch`（普通视频）、`/results`（Search）。
- **Phase 2**：频道主页、`/feed/subscriptions`、播放列表与历史页。
- **Phase 3**：`/shorts`、Live、Premiere、多语言/地区实验变体。
- **明确延后**：`music.youtube.com`、`studio.youtube.com`、`kids.youtube.com`、独立嵌入播放器。

必须建立真实 DOM fixture 与 capability matrix；不要硬编码“所有 `/watch` 页面永远具有同一个 HTML 层级”。YouTube 可能通过 A/B 实验更改 DOM 结构，此时应允许具体适配器失效而不影响核心安全路径。

### 6.5 建议目录结构

```text
fovilo/                           # 仓库/包名只是暂定
├─ .github/
│  ├─ workflows/                  # typecheck, lint, unit, e2e, audit, release
│  ├─ ISSUE_TEMPLATE/
│  └─ PULL_REQUEST_TEMPLATE.md
├─ docs/
│  ├─ PRD.md
│  ├─ DESIGN_SYSTEM.md
│  ├─ ADR/
│  ├─ COMPETITOR_RESEARCH.md
│  ├─ THREAT_MODEL.md
│  ├─ PERFORMANCE_BASELINE.md
│  ├─ QA_MATRIX.md
│  ├─ RELEASE_RUNBOOK.md
│  ├─ CHANGELOG.md
│  └─ EVIDENCE/
├─ public/
│  ├─ icons/
│  ├─ _locales/
│  └─ manifest.*.json
├─ src/
│  ├─ background/
│  ├─ bootstrap/
│  ├─ lifecycle/
│  ├─ adapters/youtube/
│  ├─ runtime/{feature,mode,ownership,permissions}/
│  ├─ design/{tokens,motion,material,typography}/
│  ├─ surfaces/{rail,commands,settings,toast}/
│  ├─ features/{home,watch,search,focus,cinema}/
│  ├─ storage/
│  ├─ i18n/
│  └─ shared/
├─ tests/
│  ├─ unit/
│  ├─ contract/
│  ├─ fixtures/
│  ├─ integration/
│  ├─ e2e/
│  ├─ visual/
│  ├─ a11y/
│  ├─ performance/
│  └─ adversarial/
├─ LICENSE
├─ THIRD_PARTY_NOTICES.md
├─ PRIVACY.md
├─ SECURITY.md
├─ CONTRIBUTING.md
├─ README.md
└─ package.json
```

“目录清晰”不等于“必须创建所有空目录”。按阶段创建真实使用到的模块，拒绝无需求的抽象层。

### 6.6 系统风险与防护

| 风险 | 推荐设计 | 可测试的失败条件 |
|---|---|---|
| YouTube SPA 导航 | route epoch、AbortController、幂等挂载 | 10 次切换后叠加 Rail、重复 toast、旧视频状态残留 |
| 动态 DOM 更新 | 能力检测、限域观察、恢复路径 | YouTube 新实验布局导致整页不可用 |
| 原生 DOM 所有权 | ownership registry + reversible moves | 开关后播放器/评论/菜单无法恢复 |
| 横跨执行世界 | ISOLATED 优先；必要时严格协议桥接 | 页面消息伪造能触发任意扩展操作 |
| UI 注入与 XSS | Text node / safe DOM API；限制 HTML 输入 | 字幕/标题/评论中的恶意文本执行脚本 |
| 权限过宽 | 只申请工作所需的站点与 `storage` | 非 YouTube 页面可被注入或读取 |
| 样式泄漏 | Shadow Root / 前缀 / 注入作用域 | 其他插件及原生组件 CSS 被覆写 |
| 高刷与低端设备 | 动画质量档位、可见性暂停、降级 | 持续 100% 绘制、长任务、隐藏页仍动画 |
| 持久化与升级 | schema version、migrations、rollback | 升级后设置丢失或模式自动乱跳 |
| 第三方扩展冲突 | coexistence tests / graceful skip | 与 SponsorBlock 等组合时播放器失效 |

---

## 7. 性能、安全、隐私、合规：不可退让的质量约束

### 7.1 性能度量：先测原生，再声称“更快”

对比环境必须匹配：浏览器版本、扩展组合、登录状态/fixture、网络节流、缓存、视口、硬件、实验分组和运行次数。分开记录原生站点、FOVILO 关闭、FOVILO 开启三种状态。

**候选预算（初版工程假设，需要 Phase 0 用测量确认可行性，不能视为已达到）：**

- 单次首屏启用对关键 Web Vitals 的增量影响：希望 LCP、INP 等相比相同实验条件的原生基线恶化 **不超过 10%**；若站点天然波动较大，采用重复采样置信区间，不能直接按一次值判定。
- 典型静态页面、无用户操作时，扩展自身长期循环/活跃定时器：**0 个**（特定功能明确需要的事件/观测除外）。
- 未主动打开视觉特效时，扩展背景持续绘制：**0**。
- 常见控制的可见响应：以真实输入到第一帧视觉状态变化测量，目标 **P95 ≤100ms**，不包含必须等待网络确认的完成态。
- 内容脚本注入额外 JS/CSS、常驻内存与 CPU：采集并持续设预算，禁止凭空写死“最佳”值；发布前定义测试硬件/页面的 P95 回归阈值。
- 在 60/120/144Hz 设备上分别验证 frame pacing；超预算时保持操作优先，优先降级装饰性动效。

证据要求：提交前后 trace、Long Tasks、Style/Layout/Script 时间、内存快照、构建产物大小、测试页面视频；报告实际值和误差，不把优化某个函数的耗时当作整个产品性能结论。

### 7.2 安全与隐私

- 默认仅保存设置。任何观看历史、习惯、使用时长、搜索词记录必须是**用户主动启用**，且有明确清空与导出能力。
- 默认不引入开发者服务端、不引入 analytics SDK；开发态诊断只写本机且由开发者明确触发。
- 不上传 Cookie、OAuth token、播放历史、个性化推荐、账号 ID 到第三方。
- 所有功能必须有数据流图：source、sink、retention、permission、opt-in、deletion。
- 不使用远程执行代码；不使用未审查的 CDN 脚本。锁定依赖与 CI provenance。
- 对 URL、消息来源、设置 schema、外部文案进行验证；异步响应以当前 route/video identity 检查。
- 不增加可识别用户的敏感遥测，不抓取页面信息来建立用户画像。

### 7.3 平台政策与法律

在实际商店发布前核对：

- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)（单一目的、隐私披露、最小权限、不得远程执行代码等相关要求）；
- [Chrome content scripts 文档](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)（ISOLATED/MAIN、document_start 等边界）；
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)（若使用 API，审查适用限制；不得将 API 合规扩展为对任意抓取的许可）；
- [Mozilla Firefox 扩展文档](https://extensionworkshop.com/)（Firefox 对 MV3/打包/审核的差异）；
- 依赖、字体、图标和灵感来源各自的许可证；
- 使用名称与营销内容时声明非 YouTube/Google 官方、不暗示获得官方背书。

**注意**：浏览器能够技术性访问网页 DOM，不意味着任何批量数据抓取或 API 逆向行为都得到平台条款授权。本项目默认不依赖此类行为。

---

## 8. 四轮对抗性审查：反方如何击败我们

此处是对**拟议方案**进行的设计层审查，结果是风险/修正建议，**不是现有软件已经通过安全或性能验收**。

### Round 1 — 产品同质化攻击

**攻击**：Kempt 已经能改 UI、提供标签、字体、模式开关；YouTube Enhancer 有大量功能。FOVILO 只是包装更漂亮，毫无独立价值。

**证伪实验**：做 5 项盲测任务（首页找到某频道新视频、观看时调整专注度、视频中查阅评论后返回、切换模式并保留播放、搜索后继续上个视频）。将原生、Kempt 与 FOVILO 的成功率、任务时长、误操作、偏好度比较；用多个参与者和不同设备，预注册指标。

**修正**：把核心竞争力收敛到 Intent Modes + Context Rail + Continuity，而不是某个视觉皮肤。若实测未形成优势，删去不必要的 UI 层。

**结论**：**开放风险，高优先级**；产品差异化需要实证。

### Round 2 — 平台脆弱性攻击

**攻击**：YouTube SPA、实验布局、直播、Shorts、视频小窗、评论和登录态让所有 DOM 操作变得不稳定。

**证伪实验**：构造 DOM 变体、延迟挂载、10–30 次快速导航、视频切换、返回前进、节点重建、未知元素；注入过期异步结果，并断言原生播放器始终可用。

**修正**：capability-based adapters + route epoch + ownership registry + circuit breaker + graceful degradation；核心界面首次只做非侵入增强。

**结论**：**可工程缓解，但长期维护不可消除**。

### Round 3 — 性能与审美冲突攻击

**攻击**：复杂 blur、shader、glass、spring 带来滚动掉帧和过度兴奋的界面，特别是在 4K、120Hz、核显笔记本和多标签页。

**证伪实验**：6 种性能/功耗场景（高刷、低配、4K、后台、减少动效、持续滚动），将 GPU/CPU trace、P95 帧时长和功耗代理指标与原生比较。观察用户是否在任务中开启/关闭视觉效果。

**修正**：default flat material、motion only where informative、decorative budget、按需初始化 GPU、长任务时自动降档；独立的审美评分必须与可用性并列。

**结论**：**首发必须默认轻量；重视觉作为可选增强**。

### Round 4 — 安全、许可证与发布攻击

**攻击**：直接复刻 MARGIN/Kempt 组件、使用来历不明 SVG、复制 GPL 代码却不遵守条款、扩大权限、假装 YouTube 官方或误触商店政策。

**证伪实验**：代码相似性/third-party 扫描、许可清单、manifest 权限差异检查、CSP 审查、消息伪造测试、XSS fixture、网络外连审核、品牌冲突核查、商店预审清单。

**修正**：clean-room 实现；第三方引入走 ADR；权限审批和 Release Checklist；公开发布前再核对政策。

**结论**：**P0 blocker，任何未解决项禁止发布**。

### 总体审查记录

| ID | 风险 | 等级 | 当前状态 | 关闭条件 |
|---|---|---|---|---|
| R-01 | 缺乏相对 Kempt 的独立价值 | P0/Product | Open | 用户任务盲测及差异化叙述通过 |
| R-02 | SPA 导航与原生 DOM 破坏 | P0/Engineering | Open | Navigation/ownership E2E 全过 |
| R-03 | 动效拖累性能和操作 | P1/Perf | Open | 对照 trace 与性能门禁通过 |
| R-04 | 许可证、品牌、商店审核 | P0/Legal | Open | 审查记录与 release sign-off |
| R-05 | 扩展生态冲突 | P1/Compatibility | Open | 预定义共存矩阵通过 |
| R-06 | 国际化/无障碍不足 | P1/Quality | Open | a11y、英文多语言长文案矩阵通过 |
| R-07 | 功能膨胀损害维护性 | P1/Process | Open | PRD 与 ADR 约束、删除无效功能 |
| R-08 | 公开发布后缺少反馈闭环 | P1/Operations | Open | issue triage、release/rollback runbook |

---

## 9. 开发路线图与阶段 Gate

### Phase 0 — 证据冻结与立项（先做）

**交付物**：竞争基线、功能矩阵、原生 YouTube 路由与 DOM 变体录制、产品命名检查、PRD、设计原则、最小权限表、威胁模型、性能测量方案、ADR-001。

**Gate 0**：能够清楚回答“为何用户应选择 FOVILO，而不是 Kempt / Enhancer”；定义 MVP，确认没有许可/商标的明显阻断，明确证据空白。不得跳过此阶段直接制作漂亮页面。

### Phase 1 — 安全骨架与最小可用增强

- 建立 MV3、TypeScript、lint/test/build/CI；
- 路由内核、feature registry、storage schema、卸载/回滚机制；
- ISOLATED world 注入、`on/off`、`Return to YouTube`；
- 首页/播放页轻量增强的一个垂直切片；
- Playwright 测试原生播放与恢复。

**Gate 1**：正常 YouTube 可用；开/关扩展后播放器、评论、导航保持语义；无重复挂载、无观测器泄漏；最低权限。

### Phase 2 — 视觉设计系统与三种意图模式

- 设计 token、字体、层级、控件状态、焦点、深浅主题；
- Everyday/Focus/Cinema 状态机；
- Context Rail + Command Surface；
- 首页/搜索/播放页响应式布局；
- 体验评审（设计、可用性、可访问性）。

**Gate 2**：在不开装饰动画的条件下可见品质改进；触摸与键盘可达；模式切换不打断播放。

### Phase 3 — 稳定性 / 性能 / 国际化

- SPA 异步竞争、DOM 变体、降级策略和第三方扩展兼容；
- 优化每次导航、首屏脚本、CSS/字体、DOM 访问；
- reduced-motion、低性能策略；
- 视觉回归、a11y、英文/中文及 RTL smoke；
- 多设备/多刷新率实测（条件不具备时列为未验证，不得假装通过）。

**Gate 3**：所有 P0/P1 已关闭；质量指标、对照 trace、测试失败复现记录齐全。

### Phase 4 — Beta / Publish / Iterate

- 完成 Privacy、Security、Permissions rationale、README、安装说明、截图和示例视频；
- 自动生成可复现构建、ZIP、校验和、变更日志；
- 通过商店要求的权限、政策、商标和账号审核；
- Chrome Web Store / Edge / Firefox 按各平台实际支持及审批状态发布；
- 监测 GitHub issues、用户自愿反馈、故障回归，不默认引入产品遥测。

**Gate 4**：发布说明能准确对应可验证功能；线上发布需要实际授权的发布身份与凭据，不能用“模拟发布成功”代替；有 hotfix 和回滚路径。

### 里程碑控制

- 每个 Phase 必须保留 **Definition of Done / Evidence / Known Limitations / Reproduction** 四类输出。
- Agent 可以在授权范围内持续推进，但**不能绕过法律/安全阻断项**或提交需要额外批准的外部账号操作。
- 若后续阶段失败，应回退到上一 Gate 的最后可复现状态，而非继续叠加临时补丁。

---

## 10. Agent 总管与 subagents 的执行组织

### 10.1 推荐角色

| 角色 | 主要责任 | 不能做什么 |
|---|---|---|
| **Orchestrator / Tech Lead** | 全局计划、依赖、决策、集成、Gate 与版本推进 | 不能以口头“完成”代替证据 |
| **Research & Product** | 竞品、用户场景、实验、PRD、差异化 | 不能直接把竞品代码提交产品仓库 |
| **Design Systems / Motion** | 视觉规范、组件状态、交互原型、动效语法 | 不能未经基准强上重 GPU 效果 |
| **Extension Architecture** | 生命周期、adapter、权限、状态恢复 | 不能无审查侵入 MAIN world/原生播放器 |
| **Feature Engineering** | Home/Watch/Search/模式/命令 | 不能绕过 Feature Registry 与单项关闭 |
| **QA & Performance** | 测试矩阵、E2E、性能证据、回归 | 不能把 mock 测试伪称真实账号实测 |
| **Security/Compliance & Release** | 许可证、安全、隐私、商店、SBOM、发布 | 未授权不得操作私有凭据、不能忽略 P0 |
| **Independent Red Team** | 以失败为目标攻击假设与实现 | 不与被审查者共享“通过答案”作为唯一验收 |

小团队可以合并角色，但必须保持**实现者与 Gate 审核者的角色独立**。并行开发应先锁定接口、文件所有权与验收约束；不要让几个 agent 同时重写 bootstrap 或全局 token。

### 10.2 并行依赖

```text
Research/Product ──┬──> PRD / Benchmarks ──────────┐
                   ├──> Brand & License Audit      │
                   └──> UX Task Matrix             │
                                                   v
Design Agent ────────> Tokens / Modes / Prototypes ───> Feature Agent
Architecture Agent ──> Lifecycle / Adapters ───────────> Feature Agent
                                                        |
QA/Perf Agent ───────── tests + baseline <───────────────┘
Security/Red Team ───── audit each gate ────────────────> Orchestrator
                                                         |
Release Agent <──────── approved artifacts / signatures ┘
```

### 10.3 每个子任务的格式

```yaml
task_id: FV-<number>
objective: <一条可检验的结果>
owner: <subagent role>
inputs:
  - <文件、来源、协议、已冻结 ADR>
allowed_files:
  - <该 agent 可修改的目录>
non_goals:
  - <明确不能触碰的行为>
acceptance:
  - <自动或手动断言>
evidence:
  - <命令、日志、trace、截图、录像、文件路径>
risks:
  - <失败模式和停止条件>
depends_on:
  - <task_id>
reviewer: <independent agent>
```

### 10.4 进度报告格式

每次集成输出：已完成的真实文件与 commit、运行的测试命令和结果、性能对照、已知缺陷、风险变更、下一批可执行任务。不能使用“应该没问题”“理论上通过”作为验收；缺少设备、账号或发布凭据时，明确列为 `BLOCKED` 与可继续进行的替代工作。

---

## 11. 测试与验证矩阵（Agent 必须实施）

### 11.1 测试层级

- **Unit**：token、配置、模式状态机、路由识别、取消与过期结果、权限白名单、持久化迁移。
- **Contract**：YouTube DOM fixture、capability adapter、ownership restore、节点缺失降级。
- **Integration**：实际浏览器中的 content script、Shadow DOM、消息传递、CSS 隔离。
- **E2E**：原生视频播放、暂停、进度条、字幕、全屏、评论、侧栏、订阅入口、SPA navigation。
- **Visual**：主题、视口、字体、RTL、动态/静态模式的稳定截图。
- **A11y**：键盘导航、焦点、ARIA、色彩对比、缩放、减少动效。
- **Security**：XSS 文案、消息伪造、域名白名单、异常 URL、存储与外部请求审计。
- **Performance**：native/off/on 对照，启动、连续导航、滚动、长期驻留、后台冻结、高刷。
- **Coexistence**：与常见 YouTube 扩展分别/组合启用，发现冲突后用户可自行禁用单项功能。
- **Release**：zip 与 source 的可重复构建、manifest、声明权限、source map、license、商店素材与发布文案。

### 11.2 关键场景

1. 首次安装后进入 YouTube 首页：不登录仍可用；默认视觉稳定，关闭后原生完整恢复。
2. `watch(A) → search → watch(B) → back → forward`：没有重复 Rail、旧状态、视频错误绑定。
3. 评论框输入、删除、发送，弹出原生菜单：FOVILO 不重复点击或干预提交。
4. 视频自动播放、播放列表切集、全屏/影院/迷你播放器、字幕切换、广告与会员提示：不破坏原生逻辑。
5. 断网、接口变慢、YouTube 实验布局：不会陷入遮罩/转圈或无限 DOM 扫描。
6. 快速开关模式 20 次、关闭扩展、返回原生：样式、焦点、原生节点、观察器全部恢复。
7. 120/144Hz、software rendering、tab hidden、reduced-motion：禁用不必要 GPU、无后台持续循环。
8. Kempt/SponsorBlock/RYD 与本项目共存：有记录的兼容性结论；遇到不兼容时保守让出控制权。
9. 英文超长标题、德语长词、阿拉伯语方向、中文混排、200% 缩放：无内容遮挡。
10. 无法获得真实登录测试环境时，必须记录未验证路径，不得将 hermetic fixture 冒充线上账户测验。

### 11.3 失败处理

- `P0`：原生播放不可用、敏感信息泄露、未经许可抓取/代码复制、权限越权、用户输入被误提交、无法恢复原生页面——**必须停止发布**。
- `P1`：主要页面导航损坏、严重卡顿、重要无障碍失败、设置迁移丢失、存在明显品牌冲突——**必须在 Beta 前关闭**。
- `P2`：局部视觉细节或可选功能缺陷——可带明确说明进入受限 Beta，但必须有退出与禁用路径。

---

## 12. 可直接交给 Agent 总管的完整提示词

> **使用方法**：从下一行“PROMPT START”复制至“PROMPT END”，连同本文件其余章节作为 reference specification 交给你的 Agent 总管。若总管可以读取此文件，直接让它将本文件作为项目首份 `MASTER_SPEC.md`。以下指令面向真实执行，不只是产出计划。

### PROMPT START

你是 **FOVILO（暂定名）项目的 Autonomous Engineering Orchestrator / Product & Technical Lead**。你可以组织若干 subagents 并行进行调研、设计、架构、编码、测试、审查、文档、性能优化和发布准备。你的任务不是交付一个漂亮截图、一次性 demo 或罗列待办，而是以可复现、可维护、合法合规的工程方法把一个独立、现代、全球化的 YouTube Experience Extension 推进至可发布和持续优化状态。

#### A. 使命与产品原则

请新建一个与 [MARGIN](https://github.com/jiuyang5354/bilibili-margin) **同生态位但异构**的 YouTube 浏览器扩展，吸收其抽象设计思想（原生能力不替代、重新组织浏览体验、精致交互、重视性能与恢复），但绝不将其代码、具体 UI 表达、位移贴图、图标、品牌资产、Bilibili 逻辑或整体接管架构直接移植。对 Kempt、YouTube Enhancer 等开源实现也采取相同立场：研究思想、功能缺口与失败经验，而非照抄代码。

产品目标：**清晰、灵动、克制、独立、可预测、无障碍、低开销**。用 `Intent Modes + Context Rail + Continuity Engine + Design Runtime` 形成独立技术与产品特色。YouTube 自身播放器、视频/账号/评论/字幕/订阅/导航是原生行为权威，默认只做可逆增强。

此文件所有审查项均为**尚待验证的任务**，不能假定已通过。

#### B. 启动方式：立即推进，不停留在讨论

1. 先检查当前运行环境、工作目录、Git 仓库状态、可访问工具、测试浏览器、可用 API/凭据和已有文件；不得覆盖用户已有未提交更改。
2. 在可授权的项目工作区建立独立仓库（或独立新分支/目录），不要向 MARGIN、Kempt 或其他参考仓库直接推送。
3. 将本文复制或索引到 `docs/MASTER_SPEC.md`，创建 `docs/DECISIONS.md`、`docs/RISK_REGISTER.md` 和迭代任务板。采用可追踪编号、负责人、验收项和证据路径。
4. 启动**只读调研子代理**：参考项目结构/许可证、竞品与用户场景、YouTube SPA/DOM、官方扩展规范/商店政策/品牌检查。每人提交可追溯 URL/commit SHA/发现与反证。
5. 并行启动**架构子代理**和**设计子代理**，但在 ADR/接口冻结之前禁止同时修改关键入口或全局 token。
6. 根据 Phase 0 成果选定 MVP 并冻结 Gate 0，再启动实现任务。禁止因产品文档未完成而无限延迟，但也禁止略过明显 P0 风险直接公开发布。
7. 项目代号暂定 `FOVILO`；对名称、图标和品牌继续查重，若可能混淆，独立提出更名方案。最终名称必须由授权负责人确认后再用于商店发布。

#### C. 工程约束与推荐栈

- Chrome/Edge MV3 优先；Firefox 单独构建及兼容性验证。TypeScript strict；Vite 或等价成熟构建器；ESLint/格式化/单元测试/Playwright/axe-core（或同类无障碍检测）。
- ISOLATED content script 为默认；Shadow DOM 包装自有 UI；原生 YouTube DOM 只能限域、按能力增强。
- 禁止默认向 YouTube 注入全页隐藏遮罩、接管播放器/评论协议、修改全局 fetch/XHR、拦截账号 Cookie、绕开平台访问限制或用未授权 API 抓取推荐流。
- 任何 MAIN world 桥接、webRequest、额外 host permissions、外部 API、复杂渲染引擎都先写 ADR，包含收益、替代方案、威胁模型、性能成本、可撤销性与审批记录。
- 必须有 feature registry、route epoch/generation guard、AbortController、disposal、ownership registry、error boundary/circuit breaker 和单功能 on/off。
- 默认只保存必要配置。未经用户启用不得追踪搜索、观看历史、操作行为或向开发者服务器上传数据。
- 每个 feature 的 `mount`/`unmount` 必须幂等，快速路由切换或异常不会泄漏观察器、重复 UI 或留下不可逆原生 DOM 修改。
- UI 的设计 token、字体、SVG、动效和材质自己实现或使用许可证兼容的素材，须保留归属；不要让任何 “inspired by” 变成实质性复制。

#### D. 分组授权与并行管理

将任务按 Product, Design, Architecture, Features, QA/Perf, Security/Compliance, Red Team, Release 分工。每个子任务提供 `objective / input / allowed_files / acceptance / evidence / risk / reviewer`，设唯一写入责任区。若 subagents 实际不可用，由你在单进程中以同等审查角色执行，不得伪称已创建并行子代理。重要设计和发布 Gate 需要独立复核人。

优先让调研、设计与架构**并行准备**，在 MVP 合约冻结后让功能实现与测试夹具同步推进。遇到文件冲突，合并到集成分支统一审查，不允许通过强制覆盖消除冲突。

#### E. 详细执行序列

**E0 — 研究与预注册**：
- 读取 MARGIN 当前 SHA 与相关源码/credits/privacy/performance；读取 Kempt、Enhancer、Minimalist、Unhooked、SponsorBlock、DeArrow、RYD 的公开资料及许可证；不要做许可证猜测。
- 制定相对竞品差异化表，说明为什么要做 Context Rail、三种意图模式与 Continuity Engine。
- 用真浏览器或可复现 fixture 检查 YouTube 的 Home/Watch/Search SPA 生命周期、多个视口、登录/不登录。
- 保存 baseline screenshot 与 performance trace。将所有主张标记 `verified / inferred / proposal / unverified`。
- 输出 PRD、ADR-001、Design Spec v0、Threat Model v0、QA Matrix v0，更新 Risk Register。

**E1 — 基础设施**：
- 完成项目脚手架、最小 MV3 manifest、权限表、content bootstrap、route kernel、feature lifecycle、config storage、recovery switch。
- 先实现一个最小端到端功能：普通 Watch 页注入一个可关闭的轻量控制，并验证原生播放/关闭/导航完全正常。
- 加入 TypeScript、lint、unit、Playwright smoke、CI、自动恢复/卸载测试；任何注入失败不能瘫痪页面。

**E2 — 设计与核心体验**：
- 实现独立 Design Tokens、light/dark/system、布局密度、控件/图标体系、键盘焦点、减少动效。
- 先完成 Everyday，确认清晰的 title/channel/metadata 层级；再实现 Focus、Cinema 模式的可逆状态机。
- 上线 Context Rail 和 Command Surface；每个操作都要有成功、失败、取消与延迟反馈，不能用假的服务器状态确认。
- 制定真实交互场景测试：连续导航、模式快速反转、画中画/字幕/评论/播放列表。

**E3 — 质量与对抗审查**：
- 执行用户体验同质化审查、平台生命周期攻击、性能极限测试、安全许可与发布合规审查，分别输出发现、反例、修正、复测结果。
- 用原生/off/on 三态做可重复的性能测试，记录环境、变异、trace 和证据。没有硬件时明确 `not verified on physical 120/144Hz`。
- 运行 a11y、i18n、RTL、多视口、200% zoom、third-party coexistence 测试。
- 禁止绕过失败 Gate；分 P0/P1/P2，尽量以最小可行代码修复根因，不要临时叠加大量 `!important`/MutationObserver。

**E4 — Beta 与发布**：
- 构建隐私政策、许可声明、贡献指南、README、截图、演示、安装/故障排查、版本说明；生成扩展包及校验和。
- 取得实际授权账号、必要审批和合适的发布身份后，按 Chrome Web Store、Edge Add-ons、AMO 的真实审核流程推进；无法获得授权时只完成可发布包及 release checklist，不声称已上架。
- 在已授权 GitHub 仓库中创建 Release/PR、记录发行版本和标签；确保 CI 产物可追溯到 commit。
- 迭代周期内继续分类用户反馈、对抗新 DOM 变体、维护兼容性，并持续更新风险矩阵、性能基线与 changelog。

#### F. 每阶段硬性验收标准

- `Build / Typecheck / Lint / Unit / Contract / E2E / Visual / A11y / Security / Performance` 按阶段要求执行，报告**真实运行过的命令、输出、日期、环境与结果**；未执行的写 `NOT RUN`。
- 用户关闭功能或关闭扩展后，原生页面恢复完整，播放器不重载、字幕/评论/导航不损坏；不重复创建 UI 或监听器。
- 无外部服务默认开启，无多余权限，无第三方代码许可风险未决。
- 不在 low-end 或 high-refresh 条件下制造明显退化；如果未能量化，标为 `UNVERIFIED` 并阻断“高性能”宣传。
- 性能与设计权衡可解释：每个高开销视觉效果必须有必要性、测量证据和关闭/降档路径。
- 发现与竞品同质化时，必须提出可检验的用户价值差异；视觉相似不可作为“已经创新”的证明。

#### G. 输出格式与自治边界

每次工作循环输出：

1. `Current Stage / Gate`：当前阶段、整体状态、未完成的阻断项；
2. `Verified Progress`：实际新增/修改的文件、commit、PR、测试结果；
3. `Decisions`：新增 ADR、技术取舍、原因和替代方案；
4. `Evidence`：截图、录屏、benchmark/trace、可复现命令；
5. `Red-team Findings`：攻击与反证、风险等级、关闭状态；
6. `Next Executable Tasks`：下一批有文件责任区和验收条件的任务；
7. `External Blockers`：账号、域名、许可证、商店审批、硬件设备等尚未具备的条件。

不得向用户反复索取已经提供的信息；在权限允许时主动推进。对于确实需要用户操作/授权/密钥的外部步骤（例如公开仓库创建、商店提交、商标定稿、真实账号登录），只提出**最小必要的具体阻断请求**。不绕过授权、不猜测 token、不声称自己完成了不可访问的操作。没有后台调度机制时不能承诺离线持续工作；在当前授权工作周期内尽可能完成工作，并留下可恢复的机器可读状态。

**最重要的指令**：持续用“用户能否更快、更清楚、更愉悦地完成观看任务，并且随时无损回到原生 YouTube”审查所有技术与视觉选择。一个漂亮但脆弱、费电、妨碍播放的插件是失败产品；一个稳定但与既有工具没有实质差别的插件也尚未达成立项目标。

请现在从环境核验、只读调研、Gate 0 预注册、风险登记与最小工程骨架开始实际执行，并在每个阶段基于证据推进，而不是停在计划层面。

### PROMPT END

---

## 13. 原始资料与官方文档索引

### 核心参考仓库

1. MARGIN 源码：https://github.com/jiuyang5354/bilibili-margin  
2. MARGIN README：https://github.com/jiuyang5354/bilibili-margin/blob/main/README.en.md  
3. MARGIN 设计引用：https://github.com/jiuyang5354/bilibili-margin/blob/main/docs/design-references.en.md  
4. MARGIN 性能记录：https://github.com/jiuyang5354/bilibili-margin/blob/main/docs/performance-2026-11-07.md  
5. MARGIN MIT 许可证：https://github.com/jiuyang5354/bilibili-margin/blob/main/LICENSE  
6. Kempt：https://github.com/remonilo/kempt-yt  
7. YouTube Enhancer：https://github.com/YouTube-Enhancer/extension  
8. YouTube Minimalist：https://github.com/isaacyauk/Youtube-Minimalist  
9. Unhooked Open Source：https://github.com/Havockeyan/UnhookYoutube-opensource  
10. SponsorBlock：https://github.com/ajayyy/SponsorBlock  
11. DeArrow：https://github.com/ajayyy/DeArrow  
12. Return YouTube Dislike：https://github.com/Anarios/return-youtube-dislike  

### 官方政策/工程资料

- Chrome Extensions / content scripts：https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts  
- Chrome Extensions / permissions：https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions  
- Chrome Web Store Program Policies：https://developer.chrome.com/docs/webstore/program-policies/policies  
- YouTube API Services Developer Policies：https://developers.google.com/youtube/terms/developer-policies  
- Mozilla Extension Workshop：https://extensionworkshop.com/  
- WCAG 2.2：https://www.w3.org/TR/WCAG22/  

### 证据与不确定性说明

- 本文“已核实事实”以读取公开仓库文件和可访问的公开文档为基础；**不是对参考项目的所有源码、依赖、运行时行为和安全性的全量认证**。
- 本文的名称、配色、路线图、实现栈与性能阈值是**新项目提案**，需要被用户研究、原型和性能数据验证。
- 商标名称、第三方许可、浏览器商店政策和 YouTube 条款可能变更，应在发布前重新审查；本文不提供法律保证。
- 没有因为参考项目出现 Issue 就认定该 Bug 在最新版本仍存在；问题仅用于归纳设计/工程风险。
- 性能必须区分模拟测试、headless 浏览器、软件渲染和真实物理设备，不能跨级推论。

---

## 14. 最终立项建议

**优先级顺序：原生稳定性 > 可逆性/安全 > 信息架构与交互连续性 > 可访问性 > 性能 > 视觉表达的精致度 > 非核心装饰特效。** 这不是否定美术；恰好相反，只有把前六项做对，视觉设计才具有长期产品价值。

建议不以“最像 MARGIN 的 YouTube”作为宣传，而以**“一种重新构建观看秩序的轻量、精致、可逆体验”**作为独立价值。MARGIN 是思想启发；Kempt 是必须认真击败的直接竞争基线；FOVILO 的立项成功与否，应由实际任务表现、用户信任、原生兼容性和独立审美来证明。
