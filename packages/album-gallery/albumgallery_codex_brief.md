# albumgallery Codex Brief

## 目标

在当前工程中新增或完善 `albumgallery` 方向：一个 Web 端 3D 专辑 Gallery + 黑胶音乐播放视频模板。最终效果是：Remotion 视频从 Gallery 开始，Gallery 自动滑动到目标音乐，进入音乐播放界面后开始播放音乐，音乐界面展示黑胶唱片动画和当前音乐封面，音乐播放结束后回到 Gallery，视频在 Gallery 状态结束。

## 目标参考链接

1. MD Vinyl 黑胶播放器参考：
   https://x.com/nanshanjukr/status/2070509256625795153

2. Three.js 3D Album Viewer / Cover Flow 参考：
   https://x.com/mats_zip/status/1834558356263977100

3. Album Viewer 站点参考：
   https://album-viewer.mats.zip

4. 可借鉴源码方向：
   https://github.com/addyosmani/threejs-coverflow

## 执行原则

先读取当前工程结构，再决定代码落点。不要在未理解现有 workspace、package 管理、Remotion 入口、资源路径、构建命令之前预设具体文件路径。

先给出最小可运行方案，再落代码。优先复用当前工程已有的 React、Remotion、音频资源、封面资源、构建方式和 lint/typecheck 规则。

`albumgallery` 内部承担所有 UI：Gallery UI、专辑卡 UI、音乐播放 UI、黑胶唱片 UI、封面展示 UI、进度 UI、Remotion 视频时间轴。音乐数据使用现有的 10 首音乐资源，读取方式按当前工程实际结构确定。

## 技术路径

主路径：React + React Three Fiber + Three.js + Remotion。

React 负责组件化 UI 和状态表达。React Three Fiber 负责 3D Gallery 场景，包括专辑墙、相机、灯光、空间排布。Three.js 负责专辑盒几何体、封面纹理、材质、相机、基础 3D 对象。Remotion 负责用 frame 驱动全部动画，并渲染成视频。

Gallery 交互版可以以后扩展鼠标、滚轮、拖拽。当前 Remotion 版本优先使用确定性时间轴：所有运动由 frame、selectedTrackId、audio duration 决定。

## 视觉流程

阶段一：Gallery 初始展示。画面显示 10 张音乐封面组成的 3D 专辑墙或 Cover Flow。中心有主视觉，左右专辑带透视、倾斜、缩放和层级。

阶段二：Gallery 自动滑动到目标音乐。目标音乐由 props 或配置中的 selectedTrackId 指定。Gallery 从初始位置滑动，使目标专辑进入中心。

阶段三：进入音乐界面。目标专辑放大，其他专辑退到背景。当前封面进入播放器布局，黑胶唱片从封面后方或旁边滑出，唱针落下，播放器 UI 出现。

阶段四：音乐播放。音频从音乐界面进入完成后开始。黑胶持续旋转，封面保持展示，进度条随播放推进，标题与歌手信息显示。可选：背景色从当前封面或 themeColor 派生。

阶段五：回到 Gallery。音乐结束后，唱针抬起，黑胶收回，当前封面回到 Gallery 队列，镜头回到 Gallery 状态，视频结束。

## 时间轴方向

时间轴由以下部分组成：

```txt
galleryIntroFrames
+ slideToTrackFrames
+ enterPlayerFrames
+ audioFrames
+ returnGalleryFrames
```

`audioFrames` 根据选中音乐的音频时长换算：

```txt
audioFrames = ceil(audioDurationInSeconds * fps)
```

音乐开始帧：

```txt
audioStartFrame = galleryIntroFrames + slideToTrackFrames + enterPlayerFrames
```

播放进度：

```txt
playProgress = clamp((frame - audioStartFrame) / audioFrames, 0, 1)
```

黑胶动画：

```txt
vinylRotation = playFrame * rotationSpeed
tonearmAngle = lerp(startAngle, endAngle, playProgress)
```

## 3D Gallery 方向

每张专辑需要有实体感。可优先用薄盒子表达专辑厚度：正面贴 cover，侧边使用深色或从封面提取的主色，背面使用暗化封面或纯色材质。

Gallery 排布参考 Cover Flow：选中项居中正对相机；左侧专辑向右内倾；右侧专辑向左内倾；距离中心越远，透明度、亮度、缩放、Z 深度逐步降低。

Gallery 滑动优先通过 `currentGalleryIndex` 插值完成：

```txt
currentGalleryIndex: initialIndex -> selectedIndex
albumOffset = albumIndex - currentGalleryIndex
```

每张专辑的位置、旋转、缩放、透明度由 `albumOffset` 推导。

## 音乐界面方向

音乐界面只展示当前选中音乐。核心元素：当前封面、黑胶唱片、唱针、标题、歌手、播放进度。

黑胶唱片第一版可以用 2D/SVG/CSS 圆盘或 Three.js 圆盘完成。作品级版本再加入唱片纹理、环形 groove、高光、中心 label、轻微反射和阴影。

封面需要占据强视觉位置。参考 MD Vinyl 的仪式感：封面与黑胶之间应有实体关系，黑胶像从封面后方滑出，播放结束后再收回。

## 数据方向

Codex 需要先查找当前工程中 10 首音乐的数据来源。目标是形成 albumgallery 可消费的数据结构：

```ts
{
  id: string;
  title: string;
  artist?: string;
  cover: string;
  audio: string;
  themeColor?: string;
}
```

字段命名可以按当前工程已有结构适配。核心要求是 albumgallery 能通过 selectedTrackId 找到对应的音频和封面。

## Remotion 方向

Remotion composition 需要支持 props：

```ts
{
  selectedTrackId: string;
  tracks?: Track[];
  fps?: number;
}
```

渲染前读取目标音乐时长，动态设置 durationInFrames。视频内音频从音乐界面完成进入后开始播放。Gallery 开场和滑动阶段不播放该音乐，保证“选择音乐 → 进入音乐界面 → 音乐开始”的叙事成立。

## 代码落地要求

先做工程侦察：识别 package manager、workspace 结构、Remotion 当前入口、音乐数据位置、资源路径、TypeScript 配置、已有样式方案、已有渲染命令。

再给出最小改动方案：说明会新增/修改哪些区域、原因、影响范围和验证命令。获得明确方向后再写代码。

实现优先级：

1. 读取现有 10 首音乐资源。
2. 建立 albumgallery 的 Remotion composition 入口。
3. 做出可运行 Gallery 初始画面。
4. 实现自动滑动到 selectedTrackId。
5. 实现进入音乐界面。
6. 实现黑胶唱片旋转与封面展示。
7. 接入音频并根据音频时长计算总帧数。
8. 实现音乐结束后回到 Gallery。
9. 跑 typecheck / build / render smoke test。

## 最小验收标准

1. Remotion 能渲染 albumgallery 视频。
2. 视频从 Gallery 开始。
3. Gallery 包含现有 10 首音乐封面。
4. selectedTrackId 能控制目标音乐。
5. Gallery 自动滑动到目标音乐。
6. 进入音乐界面后音频开始播放。
7. 音乐界面显示当前封面和黑胶唱片动画。
8. 音乐播放期间黑胶持续旋转。
9. 音乐结束后画面回到 Gallery。
10. 视频总时长跟随目标音乐时长自动变化。

## 当前实现结构

`AlbumGalleryExperience.tsx` 只负责时间轴、选中音乐、Gallery/Player 状态切换和 Remotion frame 映射。

`GalleryEntry.tsx` 负责音乐入口 Gallery：10 张封面 Cover Flow、鼠标拖拽、滚轮切换、点击进入播放器、底部迷你播放器。

`VinylPlayer.tsx` 负责 1920×1080 Remotion 播放画面：封面、黑胶、唱针、主题色、播放进度和控制条。黑胶转速当前使用 `1.1deg/frame`，避免早期版本过快。

`effects.css` 只保留 Tailwind 不适合表达的效果：专辑厚度、黑胶纹理/沟槽/高光、唱针旋转原点。普通布局、间距、文字、面板、按钮和响应式尺寸都应优先写在 Tailwind className 中。

`src/styles/tailwind.css` 必须包含 `../../packages/album-gallery/**/*.{js,ts,jsx,tsx,html}`，否则远程构建时 album-gallery 的 Tailwind class 不会进入编译结果。

## 质量重点

质感优先级：Gallery 空间排布、专辑厚度、相机缓动、封面清晰度、黑胶唱片纹理、唱针动作、返回 Gallery 的收束感。

稳定性优先级：音频时长读取、Remotion 总帧数、selectedTrackId 查找、资源路径、静态渲染确定性、typecheck、渲染命令。

## Codex 输出要求

先输出工程侦察结果和最小落地方案。代码实现完成后，输出运行命令、验证结果、未完成项和下一步建议。涉及具体文件时，只引用当前工程真实存在或实际创建的文件。
