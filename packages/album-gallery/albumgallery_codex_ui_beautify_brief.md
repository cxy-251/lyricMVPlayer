# albumgallery Codex UI Beautify Brief

## 0. 用途

这份 brief 只用于让 Codex 在现有 `albumgallery` 基础上做 UI 美化与动效质感升级。先侦察现有工程，再决定代码落点。不要在开始改代码前预设新文件结构。目标是让画面接近参考推文里的现代唱片 Gallery / 黑胶播放器质感，排除复古网页、旧播放器、终端风、廉价 carousel 风格。

## 1. 目标参考

目标推文 1：Marvix / MD Vinyl 黑胶播放细节  
https://x.com/nanshanjukr/status/2071245267743994316

目标推文 2：Marvix 转发的 Gallery 切换效果  
https://x.com/nanshanjukr/status/2070509256625795153

目标推文 3：Mats Erdkamp 的 Three.js 3D album viewer  
https://x.com/mats_zip/status/1834558356263977100

可借鉴源码 / 技术参考：Three.js Coverflow Example  
https://github.com/addyosmani/threejs-coverflow

可借鉴教程 / 技术参考：React Three Fiber + GSAP WebGL Carousel  
https://tympanus.net/codrops/2023/04/27/building-a-webgl-carousel-with-react-three-fiber-and-gsap/

官方语义参考：MD Vinyl 的产品语义是 virtual turntable + vinyl record，把数字音乐播放包装成实体唱片仪式感。  
https://apps.apple.com/us/app/md-vinyl-music-app/id1606306441

## 2. 当前问题归类

当前 Codex 产出的画面归类为“低完成度复古 UI”：视觉像旧播放器 / 老网页 demo，专辑缺少实体厚度，黑胶缺少半透明材质和真实纹理，背景与播放器控件缺少现代 app 质感，转场更像普通 carousel，距离目标推文里的“iPad 音乐 app + 3D 专辑墙 + 精致黑胶界面”还有明显差距。

这次改造的核心是审美升级：

- Gallery 要像现代 Apple Cover Flow / iPad 专辑墙。
- Player 要像 MD Vinyl 的高清黑胶播放器。
- UI 要干净、圆润、轻盈、带玻璃层、带柔和阴影。
- 画面要像产品级 app 截图，不像工程 demo。

## 3. 工作方式约束

Codex 先执行侦察：

1. 找到现有 `albumgallery` 的入口、预览命令、Remotion composition、Gallery 组件、Player 组件、音乐数据接入方式。
2. 运行现有预览或读取现有截图，判断当前 UI 的实际问题。
3. 保持现有业务流程：Gallery 开始，滑动到目标音乐，进入音乐界面，播放黑胶动画和封面，音乐结束后回到 Gallery。
4. 所有 UI 内容继续归入 `albumgallery` 包内。
5. 音乐数据沿用现有 10 首音乐资源，只消费 `title / artist / cover / audio / themeColor` 这类数据。
6. 优先改现有组件和样式，只有现有结构阻碍实现时再新增局部组件。

## 4. 视觉总方向

关键词：modern iPad music app, polished vinyl player, Apple Cover Flow, soft product render, glassmorphism, warm coral background, translucent amber vinyl, physical album slabs, cinematic shadows, high-resolution album covers, smooth Remotion motion.

排除项：retro website, old Winamp skin, terminal UI, pixel font, hard black background everywhere, cheap gradient, flat album images, flat carousel, tiny controls, heavy borders, low contrast text, noisy decorative UI, fake 3D without thickness.

## 5. Gallery 画面目标

Gallery 是开场第一屏，目标是“高级 3D 专辑墙”。参考 Marvix 主推文里的横向多张专辑队列，也参考 Mats Erdkamp 的 Three.js album viewer。

### 5.1 背景层

使用浅色舞台，不要纯黑。推荐方向：warm off-white、cream、very light beige、soft gray。背景可以有轻微径向渐变和极淡阴影，让专辑像摆在真实空间里。

建议色值：

- 主背景：`#f4f0e8` / `#f5f1ea` / `#eee9df`
- 远景阴影：`rgba(0,0,0,0.08)`
- 前景文字：`#171717`
- 次级文字：`rgba(0,0,0,0.45)`

### 5.2 专辑层

每张专辑都要是“实体薄盒”，视觉重点是厚度、侧边、封面清晰度。

实现方向：

- 3D 版本用 box / thin cuboid，不使用单张 plane 充当最终视觉。
- 正面贴封面，背面用暗化封面或深色材质。
- 侧边使用封面主色、暗色、或渐变材质。
- 专辑厚度要能被看见，尤其在倾斜角度下。
- 远处专辑降低亮度和清晰度，中心专辑保持清晰。

### 5.3 Gallery 排布

Gallery 排布使用 Cover Flow 逻辑：中心专辑正对镜头，左右专辑向内倾斜，越远越靠后、越暗、越小。

视觉参数方向：

- 中心 album：scale 1.15 到 1.25，rotationY 接近 0。
- 左右 album：rotationY 约 45 到 70 度。
- 横向间距要紧凑，形成“唱片墙”密度。
- z 方向后退要明显，产生真实空间层次。
- 专辑底部可以有非常轻的接触阴影或反射。

### 5.4 Gallery UI 层

Gallery 顶部保留非常轻的 app UI 气质：

- 顶部中间小 pill：`Albums` / `Playlists`。
- 右上角小搜索图标或圆形按钮。
- 左上角极简 icon 或菜单按钮。
- 底部中间 mini player bar，显示当前/目标曲目封面、小标题、播放图标、音量/列表小图标。

UI 使用透明白、毛玻璃、圆角、轻阴影。字体使用系统无衬线，接近 SF Pro / Inter。

## 6. Player 画面目标

Player 是进入音乐界面后的主画面。目标是接近 Marvix “more detail” 图：珊瑚红背景、左侧倾斜封面、右侧大黑胶、右上唱针、左下玻璃主题面板。

### 6.1 背景层

使用大面积温暖珊瑚红 / 橘红背景，颜色来自目标推文气质。

建议色值：

- coral：`#e76255`
- warm red：`#df5c50`
- soft orange：`#ed7a55`
- background shadow：`rgba(84, 33, 26, 0.22)`

背景可以根据当前音乐 `themeColor` 做微调，整体仍保持温暖、柔和、产品图风格。

### 6.2 封面层

当前音乐封面放在左侧或左后方，做成实体 album sleeve：

- 略微逆时针旋转，形成随手摆放的真实感。
- 封面尺寸大，清晰，占画面 35% 到 45%。
- 加柔和投影，阴影向右下方扩散。
- 封面边缘可以有轻微圆角和纸张厚度。
- 可加轻微 motion blur / image blur 只用于运动阶段，静止时保持清晰。

### 6.3 黑胶唱片层

黑胶是最关键质感模块。目标不是普通黑圆盘，而是“半透明茶色 / 琥珀色 vinyl”。

实现方向：

- 外圈大圆盘带半透明材质，能看到封面或背景若隐若现。
- 圆盘内部有同心 groove 纹理，不是纯色圆。
- 中心 label 是黑色圆形，包含当前歌名、artist、album 信息或简化文字。
- 旋转时要有细微光带扫过，形成真实唱片反射。
- 外边缘有细窄高光和轻微阴影。

可用 CSS/SVG 或 Three.js 圆盘实现。MVP 用 CSS radial-gradient 即可，作品级再换 shader / canvas texture。

建议分层：

- disc base：透明棕色大圆。
- groove rings：多层 radial-gradient 同心环。
- highlight arc：半透明白色弧形高光。
- center label：黑色圆形 label。
- edge rim：细边缘线。

### 6.4 唱针层

唱针决定“实体播放仪式感”。

实现方向：

- 唱针位于唱片右上方，杆件细长，深灰金属材质。
- needle head 是黑色几何块，不能像普通按钮。
- 音乐开始时唱针落下，播放期间角度缓慢变化，结束时抬起。
- 唱针 pivot 固定在右上角，旋转中心明确。
- 杆件加细微高光和阴影。

### 6.5 主题面板层

参考图左下角有 Player Theme 小面板。这个是提升完成度的关键 UI。

实现方向：

- 半透明玻璃卡片，圆角 18 到 24。
- 标题为 `Player Theme` 或更小字号。
- 一排小色块，当前主题有圆形选中 ring。
- 下方有 2 到 3 个 control dot。
- 卡片整体有 backdrop blur、轻阴影、白色边线。

它不需要真实交互，作为视频视觉元素即可。Remotion 版本可以固定展示。

### 6.6 进度与时间层

保留简洁时间 badge，例如左下角 `0:14`，样式接近 X 视频角标或 app 内时间胶囊。

播放界面可以有底部 mini player 或极简标题：当前曲名、artist、播放进度。字体小而清晰，不抢黑胶和封面。

## 7. 动效路线

整体动效遵循“慢、滑、软、真实物体移动”。用 Remotion `interpolate()` 做基础插值，用 `spring()` 做进入播放器和返回 Gallery 的缓动。Remotion 官方提供 `interpolate()` 用于把帧范围映射到动画值，`spring()` 用于物理感缓动。

### 7.1 时间段

沿用当前视频流程：

1. Gallery 初始展示。
2. Gallery 横向滑动到目标音乐。
3. 目标专辑浮出，进入音乐界面。
4. 音乐开始，黑胶旋转，唱针落下。
5. 音乐结束，唱针抬起。
6. 黑胶和封面收回。
7. 回到 Gallery，视频结束。

### 7.2 Gallery 滑动

目标是“相机 / 专辑墙滑动”，不要像普通网页滚动列表。

- 初始展示全部专辑或部分专辑。
- selected track 在滑动结束时进入中心。
- 滑动过程中专辑的 x / z / rotationY / scale 同步变化。
- 中心专辑有轻微放大和提亮。
- 旁边专辑逐渐退后与倾斜。

### 7.3 进入 Player

目标专辑从 Gallery 中浮出，封面变成播放器左侧 sleeve，黑胶从封面后面滑出到右侧。

- 其它专辑淡出或退到背景。
- 当前封面保持清晰，不要突然换图。
- 黑胶从封面后方平滑滑出，伴随 scale 和 opacity。
- 唱针从右上角出现并落下。

### 7.4 播放阶段

音乐播放期间：

- 黑胶持续旋转。
- groove 高光慢速旋转。
- 唱针角度随播放进度缓慢推进。
- 封面保持轻微悬浮，阴影稳定。
- 背景可根据低频或伪随机做极轻呼吸，幅度很小。

### 7.5 返回 Gallery

音乐结束后：

- 唱针抬起。
- 黑胶收回封面后方。
- 封面缩回 Gallery 中的专辑盒。
- 其它专辑重新出现。
- 镜头回到 Gallery 队列。

## 8. 技术执行方向

Codex 以现有工程为准，按以下方向做增量美化：

1. 找到 albumgallery 当前 Remotion 入口和当前 Gallery / Player 相关组件。
2. 保持现有时间轴和音乐选择逻辑。
3. 优先重做视觉样式和 motion 参数。
4. Gallery 使用 R3F / Three.js 时，优先做 album 厚度、相机透视、光照、阴影。
5. Player 可以使用 DOM/CSS/SVG 实现黑胶和 UI，也可以用 R3F 实现唱片，选择当前工程成本最低的路线。
6. 用 Remotion frame 驱动所有动画，不引入真实用户点击作为视频主流程。
7. 组件命名和落点基于现有代码，不需要为了这次美化大改包结构。

## 9. 质量标准

Codex 完成后需要满足以下视觉验收：

1. Gallery 第一帧看起来像现代 3D 专辑 app，不像复古网页。
2. 10 张专辑有空间深度和实体厚度。
3. 目标专辑滑到中心时有 Apple Cover Flow 式高级感。
4. 进入播放器后，画面接近 Marvix detail 图：珊瑚红背景、左侧封面、右侧大黑胶、右上唱针、左下玻璃主题面板。
5. 黑胶有透明感、groove 纹理、中心 label 和高光。
6. 唱针看起来像实体唱针，不像普通线段。
7. UI 字体、按钮、面板接近现代 iOS / iPad app。
8. 播放期间黑胶持续旋转，唱针缓慢推进。
9. 音乐结束后回到 Gallery。
10. 视频流程完整，音频开始点和播放器出现点对齐。

## 10. 最终给 Codex 的一句话目标

把当前 `albumgallery` 从“复古工程 demo”升级成“接近 MD Vinyl + Three.js Cover Flow 的现代音乐 App 视频模板”：开场是高级 3D 专辑 Gallery，自动滑到目标音乐；进入播放界面后，展示珊瑚红背景、倾斜封面、半透明琥珀黑胶、真实唱针、玻璃主题面板；音乐结束后回到 Gallery。先侦察现有代码，再局部美化，不预设文件结构。
