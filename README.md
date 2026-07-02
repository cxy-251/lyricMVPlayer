# lyricMVPlayer

`lyricMVPlayer` 是一个全自动的 AI 歌词 MV 视频生成项目。

## 当前状态

- 整个项目现在拥有一个统一的 Vite 开发入口，集成了播放器 (Lyrics)、特效实验室 (Effects) 和论文视频工作室 (Paper)。
- Remotion 依然作为最终导出 MP4 视频的渲染底层，但它不再作为默认的本地开发预览界面。
- 所有的歌曲、论文以及生成的视觉资产都存放在 `artifacts/` 目录下，并通过静态资源清单 (manifest) 暴露给 Web UI 使用。
- 原有的遗留目录（如 `config`、`modules`、`tools/paper-video` 等）均已清理，全面迁移至 pnpm 工作区架构。

## 核心功能

本项目旨在全自动完成音乐歌词视频的生产流水线：

1. 读取歌曲来源数据
2. 下载音频
3. 获取并自动对齐歌词
4. 生成背景视觉图像（基于 LLM 与 ComfyUI）
5. 渲染导出最终的歌词 MV 视频

这不仅是一个前端 UI 项目，更是一个完整的多阶段自动化生产管线。

## 推荐阅读顺序

1. [AGENTS.md](./AGENTS.md)
2. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
3. [docs/WEB3DLAB_DEMOS.md](./docs/WEB3DLAB_DEMOS.md)
4. [PROJECT_REQUIREMENTS.md](./PROJECT_REQUIREMENTS.md)

## 核心控制文件

- [AGENTS.md](./AGENTS.md): AI Agent 需遵循的最高优先级工作流规则。
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): 项目架构、作用域、地图以及状态说明。
- [docs/WEB3DLAB_DEMOS.md](./docs/WEB3DLAB_DEMOS.md): Web3D Lab demo 清单。
- [tasks/TASK_TEMPLATE.md](./tasks/TASK_TEMPLATE.md): 用于未来开发任务的模板规范。

## pnpm 常用命令

前端预览与渲染层面的常用命令：

- `pnpm install`
  安装项目所有依赖。

- `pnpm run dev`
  启动统一的本地工作室环境。该命令会：
  - 刷新 `public-web/` 下的静态 Web 资产
  - 在 `http://127.0.0.1:3210` 启动本地歌单同步 API (library-state sync API)
  - 在 `http://127.0.0.1:3212` 启动 Vite Web 应用

  主要的本地访问路由：
  - `http://127.0.0.1:3212/` (主播放器)
  - `http://127.0.0.1:3212/studio` (工作室首页)
  - `http://127.0.0.1:3212/studio/effects` (特效实验室)
  - `http://127.0.0.1:3212/studio/papers` (论文视频工作室)
  - `http://127.0.0.1:3212/studio/album-gallery` (专辑 Gallery / 黑胶播放器视频模板)

- `pnpm run dev:web`
  仅启动 Vite 本地 Web 应用，不开启歌单状态同步 API。
  默认预览地址: `http://127.0.0.1:3212`
  该命令会先在 `public-web/` 准备可部署的静态歌曲资产。
  注：日常本地开发更推荐使用 `pnpm run dev`，以便歌单和状态变更能被写回 `artifacts/common/library-state.json`。

- `pnpm run build:web`
  打包可用于生产部署的静态 Web 播放器至 `dist/` 目录。
  该命令**默认使用 `--demo` 参数**，只会打包固定的 10 首 GitHub Demo 歌曲，并将其资产准备至 `public-web/`。
  Paper Studio 只包含仓库内置的 10 个轻量 demo manifests；本机批量生成的 paper runs 不会进入部署包。
  推荐用于 Cloudflare Pages 等托管平台的构建。
  - Build command: `pnpm run build:web`
  - Build output directory: `dist`

- `pnpm run build:web:local`
  使用本地 `artifacts/songs/` 下所有的完整音乐库来打包 Web 播放器。
  本地生产的歌曲和 paper runs 不包含在 Git 仓库内，也不会被上传到 Demo 展示中。

- `pnpm run clean:media`
  预览可删除的冗余媒体文件（不会直接删除）。它会列出已发布歌曲的可复用人声分离文件以及 `artifacts/songsout/trash/` 下的文件。
  在查看完试运行 (dry-run) 输出后，可运行 `pnpm run clean:media --apply` 执行真实删除。

- `pnpm run use:song "<song-folder-name>"`
  切换当前直接渲染的歌曲包。
  这会更新 Remotion 的渲染入口，指向 `artifacts/songs/` 下你选择的歌曲目录。

- `artifacts/common/library-state.json`
  该文件保存着项目级别的歌单定义与默认用户昵称。如果需要添加、重命名或排序歌单，请直接修改此文件（Web 预览器不再提供创建/删除歌单的 UI）。
  自动维护的系统级歌单：
  - `New Downloads`: 每次执行 `prepare:playlist` 成功后，新处理的歌曲会被追加到这里，方便你审查。
  - `Lyrics Review`: 如果流水线找不到靠谱的同步歌词，或者发现 YouTube Music 的歌词源和音频视频 ID 不匹配，歌曲会被加入这里等待人工核对。
  - `Alignment Error`: 歌词源正确，但实际听感对齐仍有问题的歌曲会被归入此列。

- `pnpm run prepare:playlist "<playlist-url>" . [default-render-batch]`
  *(底层执行: `conda run -n kwai python backend/playlist-pipeline/playlist_pipeline.py`)*
  运行歌单处理流水线。
  该命令会下载并准备每个歌曲包资源、解析歌词、对齐音频与歌词时间轴、生成用于后续背景步骤的提示词/工作流资产、生成 `audio-features.json`，同时写入或更新 `artifacts/common/production-queue.csv`。
  运行前必须保证本地 LLM 服务（`http://127.0.0.1:1234/v1`）可用，否则命令会中止。该命令不生成背景图片，也不渲染最终的 MP4。

- `pnpm run prepare:album "<playlist-url>"`
  *(底层执行: `conda run -n kwai python backend/album-pipeline/batch_album_pipeline.py`)*
  运行轻量级的纯音乐专辑下载流水线（专供 Album Gallery 使用）。
  该命令仅下载音频文件与缩略图封面，自动存入 `artifacts/album/歌手-专辑名/`，跳过大模型和背景图片生成等重度计算环节。
  下载完成后，会自动记录在 `artifacts/album/downloaded_tracks.csv` 中，并更新画廊的全局索引库。

- `pnpm run refresh:cookies`
  *(底层执行: `conda run -n kwai python backend/audio-download/refresh_youtube_cookies.py`)*
  尝试导出可复用的 YouTube 浏览器 Cookies 到 `artifacts/common/youtube-cookies.txt`，供后续下载步骤自动复用。

- `pnpm run generate:background:current`
  向本地 ComfyUI API 提交当前歌曲的 `background-workflow.json` 并覆盖生成背景图。

- `pnpm run generate:backgrounds`
  读取 `artifacts/common/production-queue.csv`，并向 ComfyUI 批量提交生成任务（仅针对未就绪且在批次 0 的歌曲）。
  调用本地 ComfyUI 接口 (`http://127.0.0.1:8000`)。
  可指定特定批次：`pnpm run generate:backgrounds 22`

- `pnpm run regenerate:lyrics-llm-workflow-text`
  重新生成歌词理解、工作流与画面文本资产（不重新下载音频也不生成图片）。
  该命令需要本地 LLM 服务 (`http://127.0.0.1:1234/v1`) 可用。

- `pnpm run apply:manual-lyrics "<song-folder-name>"`
  如果歌曲文件夹内存在 `lyrics.manual.txt`，将优先使用该文件作为歌词源，重新进行音频对齐、覆盖 `lyrics.json`、更新 `alignedLRC.json` 等操作。

- `pnpm run render:queue [batch-value]`
  读取排队列表并渲染视频状态为 pending 且背景就绪的行。生成的 MP4 会过滤掉较长的前奏等待时间。

- `pnpm run typecheck`
  执行 TypeScript 静态类型检查，不进行打包。

- `pnpm run test:visual-effects`
  校验 Web3D Lab demo 的 metadata、注册入口和 `docs/WEB3DLAB_DEMOS.md` 清单覆盖情况。

- `pnpm run render`
  将当前选中的歌曲资源直接渲染输出为: `artifacts/songsout/<song-folder-name>.mp4`

  `render` 也支持显式目标参数，不影响 `render:queue` 的 CSV 歌词视频队列：

  ```bash
  pnpm run render -- --target album
  pnpm run render -- --target album --selected-track-id "<song-folder-name>"
  pnpm run render -- --target web3dlab --demo cinematic-style-sequence --duration-seconds 10
  ```

  Album Gallery 输出默认写到 `artifacts/songsout/album-gallery*.mp4`，Web3D Lab 输出默认写到 `artifacts/songsout/web3dlab-*.mp4`。也可以追加 `--output <path>` 指定文件。

所有命令均需在项目根目录 `/Users/cxy251/Code/04AIMedia/lyricMVPlayer` 下执行。

## Web3D Lab Blender 资产

部分 Web3D Lab demo 使用本机 Blender 生成轻量 `.glb` 运行时资产。仓库只保留必要的脚本和 Web 预览必须加载的 `.glb`，不提交 `.blend`、渲染缓存、视频中间文件或批量导出物。

当前 Blender 资产脚本：

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python packages/web3dlab/demos/040-soft-botanical-compositor/scripts/make_botanical_asset.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python packages/web3dlab/demos/041-anime-lightning-city/scripts/make_city_asset.py
```

如果本地沙盒内 Blender 因 Metal/GPU 探测失败，需要在可访问本机 GPU 的环境里运行同样命令。Blender Python 脚本必须能从仓库根目录重生成对应 demo 的运行时资产。

## Python 数据预处理

使用本地的 `kwai` conda 虚拟环境进行 Python 侧的媒体预处理工作：

- 为单首歌曲生成确定性的运动特征 (motion features)：
  ```bash
  conda run -n kwai python -c "import importlib.util, sys; p='/Users/cxy251/Code/04AIMedia/lyricMVPlayer/modules/audio-features/extract_audio_features.py'; spec=importlib.util.spec_from_file_location('audio_features_module', p); m=importlib.util.module_from_spec(spec); sys.modules['audio_features_module']=m; spec.loader.exec_module(m); print(m.extract_audio_features_for_song('/absolute/path/to/song-folder', frame_rate=60))"
  ```
  生成的文件将保存为该歌曲目录下的 `audio-features.json`。

## 架构愿景

原始需求十分庞大。上述各种控制文件与自动化脚手架的存在，是为了让项目开发保持聚焦与分阶段实施，避免在早期过度设计。
