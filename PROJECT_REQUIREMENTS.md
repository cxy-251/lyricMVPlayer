# 全自动 AI 音乐歌词视频生产系统（Remotion + ComfyUI + WebGL）完整需求文档

## 1. 项目目标

构建一个：

```text
完全自动化
无人值守
批量化
高审美
AI 驱动
```

的音乐歌词视频生产系统。

用户只需要：

```text
输入：
1. YouTube Playlist URL
或
2. 单首歌曲 URL
或
3. 生成数量（未来支持 Trending）
```

系统自动完成：

```text
读取音乐
↓
过滤重复
↓
下载音频
↓
自动获取歌词
↓
自动歌词同步
↓
自动生成插画背景
↓
自动生成 WebGL 粒子律动
↓
自动生成歌词播放器视频
↓
输出 MP4
```

整个流程：

```text
不允许人工介入
```

---

# 2. 技术选型

| 模块       | 技术                                                           |
| -------- | ------------------------------------------------------------ |
| 视频生成     | [Remotion](https://www.remotion.dev/?utm_source=chatgpt.com) |
| UI       | React + TypeScript                                           |
| 音频可视化    | `@remotion/media-utils`                                      |
| 音频频谱分析   | `visualizeAudio()`                                           |
| WebGL 粒子 | Three.js + React Three Fiber                                 |
| 视频渲染     | Remotion Renderer                                            |
| 音乐下载     | yt-dlp                                                       |
| 音频处理     | ffmpeg                                                       |
| 歌词同步     | LRC + WhisperX + Whisper                                     |
| 背景生成     | ComfyUI                                                      |
| 工作流调用    | ComfyUI `/prompt` API                                        |
| 数据管理     | JSON                                                         |
| CLI      | Node.js                                                      |
| 自动化脚本    | Python / TS                                                  |

Remotion 官方支持：

* 音频可视化
* Audio waveform
* WebGL
* Three.js
* SVG
* Canvas
* 音频频谱分析 ([Remotion][1])

---

# 3. 核心原则

# 3.1 无人值守

系统必须：

```text
全自动
不需要人工调整
不需要人工对齐歌词
不需要人工生成背景
不需要人工筛歌
```

如果某首歌失败：

```text
自动跳过
继续下一首
```

---

# 3.2 音频是唯一时间轴

所有动画必须由：

```text
currentFrame
↓
currentTime
↓
audio frequency
```

驱动。

包括：

```text
歌词
粒子
背景呼吸
UI发光
频谱
```

禁止：

```text
随机动画
实时 requestAnimationFrame 作为主时间轴
```

Remotion 推荐使用：

```ts
useCurrentFrame()
```

作为视频唯一时间源。([DEV Community][2])

---

# 3.3 渲染必须可复现

视频渲染必须：

```text
可暂停
可拖动时间轴
可稳定复现
```

Three.js / WebGL 动画必须使用：

```ts
useCurrentFrame()
```

同步。

---

# 4. 输入模式

---

# 4.1 单曲模式

```bash
npm run generate -- --url "https://youtube.com/..."
```

---

# 4.2 Playlist 模式（核心）

```bash
npm run generate \
-- --playlist "https://youtube.com/playlist?list=xxxx" \
--count 10
```

系统：

```text
自动读取 playlist
自动去重
自动生成 10 个视频
```

---

# 4.3 批量模式（未来）

```bash
npm run generate \
-- --source trending \
--count 20
```

未来支持：

```text
TikTok trending
Spotify trending
YouTube Music trending
```

第一阶段不实现。

---

# 5. 音乐来源模块

---

# 5.1 Playlist 读取

系统必须支持：

```text
公开 YouTube playlist
```

不需要 OAuth。

---

# 5.2 Playlist 读取结果

系统必须提取：

```json
{
  "videoId": "",
  "title": "",
  "channel": "",
  "duration": 0,
  "url": ""
}
```

---

# 5.3 历史去重

系统必须维护：

```text
history/generated.jsonl
```

每个生成记录：

```json
{
  "videoId": "",
  "sourceUrl": "",
  "title": "",
  "artist": "",
  "audioHash": "",
  "renderedAt": ""
}
```

---

# 5.4 去重规则

必须检查：

```text
videoId
sourceUrl
audioHash
title + artist
```

重复自动跳过。

---

# 6. 音乐下载模块

系统使用：

```text
yt-dlp
```

下载：

```text
audio
thumbnail
metadata
```

推荐格式：

```text
mp3
```

输出：

```text
assets/audio/
assets/covers/
```

---

# 7. 歌词模块（重点）

---

# 7.1 严格要求

系统：

```text
不允许人工调整歌词
不允许人工修改 offset
不允许人工寻找 LRC
```

---

# 7.2 歌词同步链路

必须实现：

```text
1. 搜索现成 LRC
↓
2. 如果没有：
搜索普通歌词
↓
3. WhisperX forced alignment
↓
4. 如果没有歌词：
Whisper 自动转录
↓
5. 自动生成句子级时间轴
↓
6. 自动质量检测
↓
7. 不合格自动重试
↓
8. 最终失败则跳过歌曲
```

WhisperX 支持 forced alignment，可自动将文本与音频对齐。([Awesome MCP Servers][3])

---

# 7.3 歌词质量检测

系统必须自动检测：

```text
时间戳递增
歌词跨度是否接近歌曲时长
是否乱码
是否大量重复
是否空白
语言是否正确
```

输出：

```json
{
  "syncConfidence": 0.91,
  "method": "whisperx",
  "status": "passed"
}
```

低于阈值：

```text
自动换源
或
自动跳过
```

---

# 7.4 支持语言

默认只允许：

```json
{
  "allowedLanguages": [
    "en",
    "ko",
    "es"
  ]
}
```

其他语言自动跳过。

---

# 8. ComfyUI 插画背景模块

---

# 8.1 风格目标

不要写实。

目标风格：

```text
anime illustration
lofi
dreamy
soft lighting
music cover
stylized
cinematic illustration
```

---

# 8.2 自动风格分析

系统根据：

```text
歌曲名称
歌手
音乐风格
歌词情绪
```

生成：

```json
{
  "mood": "dreamy",
  "style": "lofi anime",
  "palette": "purple blue"
}
```

---

# 8.3 ComfyUI API

系统必须：

```text
自动调用 workflow
自动生成背景
自动保存背景
```

输出：

```text
assets/backgrounds/
```

---

# 9. 视频模板（Remotion）

---

# 9.1 输出规格

默认：

```text
1080x1920
30fps
竖屏
```

---

# 9.2 视频结构

```tsx
<MusicVideo>
  <ComfyBackground />
  <WebGLParticles />
  <MusicPlayer />
  <Lyrics />
  <BorderText />
</MusicVideo>
```

---

# 9.3 UI 风格

播放器：

```text
Apple Music
Spotify Canvas
LoFi aesthetics
Minimal
Glow
Glassmorphism
```

---

# 10. WebGL 粒子系统（核心）

---

# 10.1 技术

使用：

```text
Three.js
React Three Fiber
```

---

# 10.2 粒子必须音频同步

粒子必须由：

```text
音频频谱
```

驱动。

使用：

```ts
useAudioData()
visualizeAudio()
```

Remotion 官方支持音频频谱分析。([Remotion][1])

---

# 10.3 粒子效果

必须支持：

```text
中心能量球
频谱扩散
边缘发光
粒子呼吸
鼓点爆发
歌词切换冲击波
```

---

# 10.4 音频频段映射

| 频段 | 控制      |
| -- | ------- |
| 低频 | 粒子扩散    |
| 中频 | 粒子旋转    |
| 高频 | 闪烁/边缘粒子 |

---

# 10.5 注意

粒子：

```text
不能遮挡歌词
```

歌词优先级最高。

---

# 11. 边框文字系统

画面边缘：

```text
横排
竖排
随机短句
网名
歌词片段
```

例如：

```text
@yourname
dream louder
stay soft
```

---

# 12. 项目目录结构

```text
music-video-system/
│
├── PROJECT_REQUIREMENTS.md
├── package.json
├── remotion.config.ts
│
├── assets/
│   ├── audio/
│   ├── covers/
│   ├── lyrics/
│   ├── backgrounds/
│   ├── output/
│
├── data/
│   ├── songs/
│   ├── history/
│   ├── cache/
│
├── src/
│   ├── remotion/
│   │   ├── Root.tsx
│   │   ├── compositions/
│   │   ├── components/
│   │   ├── particles/
│   │   ├── shaders/
│   │   ├── lyrics/
│   │   ├── player/
│   │   ├── ui/
│   │   ├── hooks/
│   │   ├── utils/
│
├── scripts/
│   ├── scan_playlist.ts
│   ├── download_audio.ts
│   ├── fetch_lyrics.ts
│   ├── align_lyrics.ts
│   ├── generate_background.ts
│   ├── render_video.ts
│
├── comfy/
│   ├── workflows/
│   ├── prompts/
│
├── history/
│   ├── generated.jsonl
│   ├── failed.jsonl
```

---

# 13. MVP 阶段

Codex 第一阶段必须完成：

```text
1. Remotion 项目骨架
2. 读取 playlist
3. 下载音频
4. 解析 LRC
5. 歌词同步显示
6. WebGL 粒子
7. 背景图
8. 播放器 UI
9. MP4 输出
10. history 去重
```

---

# 14. 第二阶段

```text
WhisperX 自动对齐
自动歌词质量检测
ComfyUI 自动背景
批量生成
失败重试
```

---

# 15. 第三阶段

```text
Trending music
自动风格分析
多模板
高级 shader
粒子系统升级
```

---

# 16. 禁止事项

Codex 禁止：

```text
不要做数据库
不要做登录系统
不要做 Electron
不要把逻辑写进单个 TSX
不要使用 setInterval 驱动动画
不要写空目录
不要写未使用代码
不要把粒子挡住歌词
不要依赖随机动画
```

---

# 17. 代码规范

```text
TypeScript 优先
组件单一职责
组件 < 300 行
utils 独立
hooks 独立
shader 独立
粒子逻辑独立
歌词逻辑独立
```

---

# 18. 第一条 Codex 指令

```text
请根据 PROJECT_REQUIREMENTS.md：

创建一个 Remotion + TypeScript 项目。

必须完成：

1. 支持读取公开 YouTube playlist
2. 自动下载音频
3. 创建 song.json
4. 支持 LRC 歌词解析
5. 当前歌词高亮
6. 创建播放器 UI
7. 创建 Three.js WebGL 粒子系统
8. 粒子必须跟随音频频谱变化
9. 创建边框装饰文字
10. 输出 1080x1920 MP4

禁止：

不要实现数据库
不要实现登录
不要实现复杂后台
不要写在单文件里
```

Remotion 官方支持 React、Canvas、SVG、WebGL、Three.js、音频频谱分析等，适合构建自动化音乐视频系统。
