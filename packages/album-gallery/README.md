# Album Gallery

`packages/album-gallery` 是专辑 Cover Flow + 黑胶播放器视频模板。Web Studio 里它是音乐入口，Remotion 里它是 1920 x 1080 的横版音乐视频 composition。

## 目录结构

- `composition/`: Remotion composition、默认 props、动态时长计算。
- `components/`: Gallery、黑胶播放器、封面等 React UI。
- `data/`: Web public manifest 读取和仓库内 10 首 demo 歌曲定义。
- `studio/`: `/studio/album-gallery` Web 预览页。
- `styles/`: 少量 Tailwind 不适合表达的黑胶纹理、专辑厚度、唱针效果。
- `utils/`: 时间轴、插值、视觉主题和 Cover Flow transform。
- `types.ts`: album-gallery 对内/对外共享类型。

## 渲染

默认歌词视频渲染命令不变：

```bash
pnpm run render
```

渲染 album-gallery 视频：

```bash
pnpm run render -- --target album
```

指定歌曲：

```bash
pnpm run render -- --target album --selected-track-id "Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ"
```

指定输出路径：

```bash
pnpm run render -- --target album --output artifacts/songsout/album-gallery-demo.mp4
```

输出默认写到 `artifacts/songsout/album-gallery*.mp4`。

## 实现约束

普通布局、按钮、文字、面板和响应式尺寸优先写 Tailwind className。`styles/effects.css` 只放黑胶沟槽/高光、专辑盒厚度、唱针旋转原点这类效果。

`src/styles/tailwind.css` 必须包含 `../../packages/album-gallery/**/*.{js,ts,jsx,tsx,html}`，否则远程构建不会生成 album-gallery 的 Tailwind class。
