<div align="center">
  <img src="docs/images/orbit-readme-hero.png" alt="太阳、行星与银河组成的太阳系概念图" width="100%" />

# ORBIT · 太阳系漫游

**面向学习的交互式 3D 太阳系观测台**

**[English](README.md) · [简体中文](README.zh-CN.md)**

[在线体验](https://orbit-henna-xi.vercel.app/) · [提交问题](https://github.com/hugogu/orbit/issues) · [功能建议](https://github.com/hugogu/orbit/issues/new)

</div>

> 上图为项目视觉封面，不是应用界面截图。ORBIT 在浏览器中运行，无需安装客户端。

ORBIT 将可交互的 3D 场景、可调时间轴和可说明来源的天文计算结合在一起。它适合用来观察太阳系中天体的相对运动、认识主要卫星和彗星，并从指定观测地点了解日出、日落与食象。

## 功能一览

|     | 能做什么                                                          | 适合了解什么                                     |
| --- | ----------------------------------------------------------------- | ------------------------------------------------ |
| ☀️  | 以当前时刻或 **1700–2200 年**的任意 UTC 时刻运行场景              | 行星位置、公转、自转与时间尺度                   |
| 🪐  | 浏览太阳、八大行星、冥王星、19 颗代表性卫星、4 颗著名彗星与土星环 | 天体类型、轨道和物理特征                         |
| 🔭  | 选中、跟随、俯视或一键返回全景；导航栏可展开卫星并直接定位        | 从太阳系全局切换到单个天体                       |
| 🌅  | 输入经纬度与固定 UTC 偏移，或使用浏览器当前位置                   | 当地某一天的日出、日落、昼长                     |
| 🌑  | 查询下一次日食、月食与下一次当地可见的日食                        | 食象发生时刻、最大食分附近的几何关系             |
| 🌗  | 显示天体昼夜分界、地球夜间灯光，以及日食时的本影、半影与影轴轨迹  | 日照、月食和日食的空间几何                       |
| ✨  | 在自动、标准 2K 与最高 8K 纹理之间选择；银河背景可单独开关        | 视觉质量与设备性能之间的取舍                     |
| 🗺️  | 可选：仅在跟随水星、金星、地球或火星时加载 2K 真实地形光照        | 公开地形数据增强近距离明暗起伏，但不改变球体网格 |
| 📱  | 支持桌面鼠标和键盘、触屏手势、手机横屏与竖屏布局                  | 不同设备上的连续探索                             |
| 🌐  | 支持简体中文、英语、日语，自动识别浏览器语言并记住手动选择        | 天体介绍、知识卡片、场景标签与天象工具完整翻译   |

## 在真实运行中观察

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/images/earth-night-lights.jpg" alt="运行中的 ORBIT：地球夜半球城市灯光" width="100%" /><br /><sub>地球夜半球：城市灯光会随太阳方向自然显现</sub></td>
    <td width="50%" align="center"><img src="docs/images/eclipse-shadow-path.jpg" alt="运行中的 ORBIT：2024 年日全食本影半影与影轴轨迹" width="100%" /><br /><sub>2024 年 4 月 8 日日全食：地球表面的食影边界与影轴轨迹</sub></td>
  </tr>
</table>

两张图片均从本项目实际运行的观测台截取。项目提供高分辨率日间与夜间纹理；会按设置、设备类型、节省流量偏好和 GPU 纹理限制选择加载质量。高分辨率材质只在需要时为当前跟随天体加载，并会在替换后释放上一份资源。

行星基础形状按观测扁率构建，并保持资料中的体积平均半径。“观测设置 → 材质”提供独立的“真实地形光照”和“真实地形几何”开关：两者采用统一经纬度的公开高程数据，起伏做 6 倍视觉增强。光照选项使用 2K 物体空间法线；几何选项重建当前跟随行星的 256×128 网格，并同步更新法线、包围范围和鼠标拾取。支持水星、金星、地球、火星；地球海平面以下按海面展示，金星显示去云地形及示意底色。两者均不计算山体投影，巨行星保留大气外观。详见[数据来源与生成方法](public/textures/planets/CREDITS.md)。

彗星现在使用各自独立的彗核网格。哈雷彗星使用 Phil Stooke/NASA PDS 模型，67P 使用 ESA/Rosetta 的低分辨率笛卡尔三角片模型；只在选中时加载，并在加载后保留缓存。恩克和海尔–波普目前没有随仓库发布的完整全球彗核模型，因此使用明确标注的观测尺寸约束近似，不冒充实测地形。彗核反照率、彗发和彗尾仍为示意。详见[彗星形状模型署名](public/models/comets/CREDITS.md)。

## 交互方式

导航中新增独立折叠的**小行星**与**彗星**分组。谷神星（矮行星）、智神星、婚神星、灶神星、灵神星、爱神星、丝川、贝努和龙宫均可在场景内定位，也有三语独立资料页、物理数据与带署名的分享图。为保持全景清晰，仅显示当前选中小行星的标签与轨道。

小行星轨道和物理参数来自 2026-09-13 获取的 [NASA/JPL SBDB](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html) 离线快照。带历元二体近似未计入行星摄动与热辐射效应，不用于交会或撞击预测；真实大小与距离设置同样适用于小行星。场景使用来自任务、PDS、Dawn、隼鸟/隼鸟二号、OSIRIS-REx、VLT/SPHERE 和 DAMIT 的独立形状数据；谷神星保留观测到的近球形，并使用 Dawn 贴图与地形法线。智神星使用 Carry 等公开、覆盖约 80% 表面的 K 波段相对反照率图，并采样到匹配的 DAMIT 形状模型上；灵神星使用与 DAMIT 1806 形状模型逐面对应的相对反照率数据。婚神星没有可下载的全球反照率图，因此保留自己的 JPL 几何反照率与光谱类别驱动的材质，不混用通用贴图。详见[形状数据署名](public/models/asteroids/CREDITS.md)与[表面贴图署名](public/textures/asteroids/CREDITS.md)。小行星不参与食影计算。

| 场景导航                                                                    | 时间控制                                   | 天文计算                              |
| --------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| 鼠标左键拖动旋转、滚轮缩放、右键拖动平移                                    | 9 档速度、暂停、回到“现在”、指定日期       | 日出日落、全球日食/月食、当地可见日食 |
| 单指旋转、双指缩放、双指平移                                                | 模拟时钟在切换天体后仍保持                 | 在食象最大时刻聚焦地球或月球          |
| `WASD` / 方向键平移，`+` / `-` 缩放，`Space` 暂停，`R` 全景，`Esc` 结束跟随 | 从实时到十年/秒，含适合观察食象的一分钟/秒 | 观测点支持手动输入与浏览器定位        |

可在观测设置中开关太阳活动效果。日冕细丝、日珥和黑子共享 UTC 模拟时钟：暂停即冻结，跳回同一日期可复现相同状态。建议用 **1 天/秒** 观察生长、消散和自转。生命周期采用数天到数月的示意范围，并体现随纬度变化的自转速度；生成的活动区不代表历史实测或未来预测。参考 [NASA 日珥](https://www.nasa.gov/image-article/what-solar-prominence/)、[NASA 黑子](https://science.nasa.gov/sun/sunspots/)和 [NASA 差异自转](https://www.nasa.gov/image-article/solar-rotation-varies-by-latitude/)。

## 场景与数据流

```mermaid
flowchart LR
  A[浏览器输入<br/>时间、地点、导航操作] --> B[React 观测台界面]
  B --> C[时间轴与状态]
  C --> D[Astronomy Engine<br/>行星、月球、伽利略卫星]
  C --> E[JPL 轨道要素<br/>其余卫星与彗星]
  D --> F[Three.js 3D 场景]
  E --> F
  C --> G[Web Worker<br/>日出日落与食象搜索]
  G --> B
  F --> H[桌面与移动端 WebGL 渲染]
```

### 可探索的天体

- **行星系统**：太阳、八大行星、冥王星、土星环，以及小行星带、柯伊伯带、散布盘、日球层和示意性的奥尔特云。
- **小行星带**：1,800 块示意岩体复用六种不规则形状，具有不同大小、朝向和哑光颜色。实例化将绘制调用控制在六次；远景每块 20 个三角面，近景提升至 80 个。位置与大小经过艺术化处理，不代表实测目录或真实空间密度。
- **卫星目录**：19 颗可独立查看的代表性卫星，包含月球、伽利略卫星和卡戎；每颗都有独立介绍页、基础物理数据、轨道数据、来源链接和随机趣味知识。
- **彗星导航**：哈雷彗星、恩克彗星、67P/丘留莫夫–格拉西缅科彗星、海尔–波普彗星。可沿时间轴观察其模型轨道，也可跳到模型中的下一次近日点。
- **知识卡片**：33 个可选天体各有 30 条带来源的“你知道吗”内容；每次打开页面会轮换，避免总是看到同一条。

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) `>= 22.13.0`
- npm（项目包含 `package-lock.json`）
- 支持 WebGL 的现代浏览器；推荐开启硬件加速

### 本地运行

```bash
git clone git@github.com:hugogu/orbit.git
cd orbit
npm ci
npm run dev
```

随后打开终端输出的本地地址。开发时，浏览器定位功能只会在安全上下文（HTTPS 或 localhost）下请求权限。

### 质量检查

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

测试涵盖 UTC 时钟、天体坐标转换、地球昼夜方向、卫星与彗星轨道、食象峰值、地点边界、纹理策略与交互状态。提交前请运行以上检查；涉及 Vercel 发布时，另外运行：

```bash
npm run build:vercel
```

## 部署

ORBIT 以静态导出方式部署到 Vercel，另有独立的 Cloudflare Worker 构建目标用于 Sites 平台；Google Analytics 为可选功能，通过一个环境变量控制。Vercel 项目配置、构建参数与分析配置请参阅[部署指南](docs/deployment.md)。

Vercel 构建还会输出可抓取的天体资料页（`/:locale/bodies/:id`）、`robots.txt` 和 `sitemap.xml`。在 Vercel 项目中部署前，请将 `NEXT_PUBLIC_SITE_URL` 设置为正式的 HTTPS 域名；构建会用它生成 canonical、Open Graph、多语言 alternate 与 sitemap 地址。未设置时使用演示域名。

## 模型边界与准确性

ORBIT 用于天文学习，并在界面中说明模型的假设与适用范围，不适用于导航或专业星历计算。显示和查询共享一个 UTC 时钟，但各部分有不同的精度范围：

| 范围                           | 实现方式                                                                                             | 使用时应了解                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 行星、冥王星、月球、伽利略卫星 | [Astronomy Engine](https://github.com/cosinekitty/astronomy) 的位置计算，转为固定 J2000 黄道场景坐标 | 用于教育观察；表面贴图经纬度并非测绘保证               |
| 其余代表性卫星                 | JPL 固定历元平均轨道要素                                                                             | 未包含摄动、共振和长期岁差，远离历元的相位误差可能较大 |
| 四颗彗星                       | JPL Small-Body Database 快照的两体传播；各自独立的实测或观测约束彗核网格                             | 未包含引力摄动和释气；近日点与回归日期不能视为精确预报 |
| 日出、日落与食象               | 独立 Web Worker 搜索；日出日落采用给定固定 UTC 偏移、太阳上缘和标准大气折射                          | 未计入地形、天气与动态夏令时；全球食象不等于当地可见   |
| 阴影                           | 物理半径与日心向量计算本影、半影和反本影，再映射到展示网格                                           | 不包含大气折射、太阳边缘变暗、地形、行星环或彗星的影响 |

### 比例设置

默认的演示模式会压缩距离并放大天体，便于在同一画面中观察。**观测设置 → 布局** 将真实大小与真实距离两个开关集中在一起。调整立即生效并保存在当前浏览器中。两个真实比例均开启时，太阳、行星与 19 颗卫星使用同一物理比例；彗核形状使用实测网格或明确标注的近似，表面、彗尾和辉光仍保持教学用示意效果。显示调整不影响模拟日期、运行周期和天象计算。

## 技术栈

| 类别       | 采用技术                                                 |
| ---------- | -------------------------------------------------------- |
| 界面       | React 19、TypeScript、Vinext                             |
| 3D 渲染    | Three.js、WebGL                                          |
| 星历与事件 | Astronomy Engine、JPL 数据与浏览器 Web Worker            |
| 样式与交互 | Tailwind CSS、Base UI、Lucide                            |
| 数据统计   | Google Analytics 4（`next/script`，环境变量控制）        |
| 部署       | Vercel 静态导出；也保留 Sites/Cloudflare Worker 构建目标 |

## 贡献

改进翻译或添加更多语言，请参阅[多语言扩展指南](docs/i18n.md)。新语言只需增加独立词库并注册；切换语言会保留当前天体、相机视角与模拟时间。

欢迎提交改进。开始前请先查看现有 [Issues](https://github.com/hugogu/orbit/issues)，避免重复工作。

1. Fork 本仓库并从默认分支新建一个聚焦的分支。
2. 保持改动小而完整；功能、重构和构建配置尽量拆成独立提交。
3. 为行为变更补充或更新测试，并运行“质量检查”中的全部命令。
4. 提交 Pull Request 时说明用户可见的变化、数据来源或模型假设的变更，以及验证方式。

报告问题时，请附上浏览器与版本、设备类型、屏幕尺寸、发生时间、所在地时区/坐标（如与地点计算相关）和复现步骤。请勿提交密钥、精确家庭地址或其他敏感信息。

## 数据与素材致谢

- [NASA Solar System](https://science.nasa.gov/solar-system/planets/)、[NASA Kuiper Belt](https://science.nasa.gov/solar-system/kuiper-belt/facts/)、[NASA Oort Cloud](https://science.nasa.gov/solar-system/oort-cloud/facts/)
- [JPL 行星物理参数](https://ssd.jpl.nasa.gov/planets/phys_par.html)、[JPL 近似位置/开普勒要素](https://ssd.jpl.nasa.gov/planets/approx_pos.html)、[JPL 卫星数据](https://ssd.jpl.nasa.gov/sats/)
- [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html)
- [NASA 日食几何](https://eclipse.gsfc.nasa.gov/SEhelp/SEgeometry.html)
- [Astronomy Engine](https://github.com/cosinekitty/astronomy)（MIT）
- 行星纹理主要来自 [Solar System Scope Textures](https://www.solarsystemscope.com/textures/)，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。实际文件尺寸、下载来源与许可记录在 [`public/textures/source-manifest.json`](public/textures/source-manifest.json)。部分纹理使用增强色彩或示意性地形；银河全景是沉浸式背景，不是观测地点的实时星图。
- 可选的行星真实表面细节来自公开 NASA/USGS 地形数据，经固定版本的 CelestiaContent 法线贴图处理并下采样；详见 [`public/textures/planets/CREDITS.md`](public/textures/planets/CREDITS.md)。这些 2K 贴图只提供光照起伏，不进行几何位移；气态巨行星没有固体表面，仍使用大气表现。
- 卫星贴图来自 [CelestiaContent](https://github.com/CelestiaProject/CelestiaContent)，各文件采用的 CC BY 或 CC BY-SA 条款记录在 [`public/textures/satellites/CREDITS.md`](public/textures/satellites/CREDITS.md)。天卫一、天卫五、天卫二、天卫三、天卫四和海卫一的 Voyager 贴图存在未测绘区域；本地副本用邻近的已观测纹理镜像填补缺口，避免近距离观察时出现单色半球。由于缺少完整全球反照率地图，海卫二、冥王星和冥卫一使用 CC BY 4.0 的 `asteroid.jpg` 作为明确标注的科普示意材质。彗星的形状模型来源和表面数据限制记录在 [`public/models/comets/CREDITS.md`](public/models/comets/CREDITS.md)。
- 小行星贴图与转换后的形状资产分别记录在 [`public/textures/asteroids/CREDITS.md`](public/textures/asteroids/CREDITS.md) 和 [`public/models/asteroids/CREDITS.md`](public/models/asteroids/CREDITS.md)；命名小行星目录不再使用通用 `asteroid.jpg`。
- 天王星使用 Solar System Scope 的 CC BY 4.0 大气示意图。原先禁止商业使用的天王星与冥卫一文件，以及再分发条款不明确的 NASA/JPL 冥王星示意图，已不再使用或随项目分发。

## 许可证

本仓库中的源代码采用 [PolyForm Noncommercial License 1.0.0](LICENSE) 授权。该许可证允许个人、教育、研究、兴趣项目及其他非商业用途，包括在本地部署和进行非商业修改，但必须遵守许可证条款；它不授予商业托管、SaaS、付费分发或商业产品使用权。

商业使用需要另行签署书面协议，详见[商业授权说明](COMMERCIAL-LICENSE.md)。项目名称、标志和官方分发规则见[商标与官方分发政策](TRADEMARKS.md)。

第三方代码、数据和纹理仍适用各自的许可证。具体素材条款请查看[卫星纹理致谢](public/textures/satellites/CREDITS.md)和[纹理来源清单](public/textures/source-manifest.json)。
