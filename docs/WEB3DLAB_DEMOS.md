# Web3D Lab Demo List

## Remotion 导出

Web3D Lab demo 可以通过统一的 render 命令导出 1920 x 1080 视频，不走歌词视频 CSV 队列：

```bash
pnpm run render -- --target web3dlab --demo cinematic-style-sequence --duration-seconds 10
pnpm run render -- --target web3dlab --demo fluid-cursor-field --duration-frames 300 --output artifacts/songsout/web3dlab-fluid-cursor-field.mp4
```

默认输出为 `artifacts/songsout/web3dlab-<demo-id>.mp4`。当前 Remotion 入口复用 Web3D demo registry；完全依赖实时 `useFrame` 或 `requestAnimationFrame` 的 demo 后续可继续逐个升级为 frame-deterministic。

| Demo | 效果目标 | 主要方法 | 复查指标 |
| --- | --- | --- | --- |
| 001 AI Blender: Fibonacci Orb | 展示黄金角粒子球的生长动画。 | Blender Python 生成的 glTF/关键帧动画，R3F 加载并提供相机控制。 | 物体不是静态球壳，能看到生长或播放状态变化；拖拽和缩放可用。 |
| 002 GPGPU Black Hole Physics | 大规模粒子被鼠标引力奇点吸引和甩出。 | FBO ping-pong GPU 计算、Verlet 风格积分、pointer 作为引力源。 | 移动 pointer 后粒子轨迹明显弯曲；重力和阻尼控制项能改变运动。 |
| 003 Liquid Metal Morph | 沸腾的液态金属形变。 | Three.js mesh deformation、噪声位移、MatCap/金属材质。 | 表面持续变形且具有金属反射感；不是普通静态球。 |
| 004 Cyber City Scanner | 赛博城市点云被扫描线扫过。 | 程序化建筑实例、点云/实例化几何、扫描 shader。 | 城市轮廓清晰，扫描带移动时亮度有变化。 |
| 005 Quantum Network | 发光节点与数据包在网络中流动。 | LineSegments、instanced packet/node geometry、自定义透明 shader。 | 节点、连线、数据包三层都可见，数据包沿连线运动。 |
| 006 Cosmic Nebula | 宇宙丝带状星云体积感。 | Curl noise 风格粒子/线条、后处理 bloom 和雾化。 | 有连续流动的体积丝带，画面不应退化成散点噪声。 |
| 007 Particle Galaxy | 指针扰动的发光粒子星系。 | Shader 粒子场、pointer force、bloom。 | 指针移动能弯曲旋臂或扰动粒子；星系有中心和旋臂结构。 |
| 008 Rails in Space | 沿闭合三维路径持续穿行的彩色 Ribbon 能量隧道。 | Catmull-Rom + Frenet 标架、单个合并 Ribbon Mesh、GLSL 流光、路径相机、星空/火花和 Bloom。 | 闭环飞行无跳变；Leva 可调整速度、轨道密度/形态、氛围和质量档位，暂停与重置有效。 |
| 009 Fluid Cursor Field | 指针搅动的液态光场。 | Fragment shader、指针速度场、trail 与 distortion。 | 快速移动 pointer 会产生更强波纹和拖尾。 |
| 010 Physics Cloth Banner | 全息布料横幅被风和指针影响。 | Verlet cloth simulation、固定点约束、程序化风场。 | 布面有柔体波动；点击或拖拽能产生局部波纹。 |
| 011 Particle Morphing Field | 粒子雕塑在多个几何形态间变形。 | 粒子 target shape、shader animation、pointer force。 | 点击后形态切换明显，粒子从旧形态过渡到新形态。 |
| 012 SDF Liquid Metaballs | 数学 smooth union 的液体 metaballs。 | Raymarching、SDF、smooth union。 | 球体之间应融合成液态连接，而不是硬边相交。 |
| 013 GPGPU Text Morphing | 大量粒子组成文字并爆散重组。 | 文本采样、GPGPU 粒子位置过渡。 | 文字可读，变形阶段粒子不会整体消失。 |
| 014 Rapier Physics Sandbox | 可交互刚体物理场景。 | Rapier rigid bodies、impulse 交互、R3F 渲染。 | 点击物体有物理响应，碰撞和重力行为稳定。 |
| 015 Audio Reactive Metaballs | 面向歌词音频特征的 metaballs。 | SDF raymarching、音频特征输入接口、反应式半径/位移。 | 静音时仍有基础动画，有音频特征时变化幅度更明显。 |
| 016 GPGPU Boids Flocking | GPU 上运行的群体行为模拟。 | Separation/alignment/cohesion 规则、GPGPU 粒子更新。 | 粒子呈群体游动，不应随机抖动或全部聚成一点。 |
| 017 Ferrofluid Core | 音频反应式铁磁流体核心。 | Raymarching、液态金属 shader、音频强度调制。 | 核心边缘有尖刺/流体形变，音频能量应影响强度。 |
| 018 Ultimate Convergence | 综合 Audio、GPGPU、Fluid、SDF 的压力测试。 | 多种渲染技术叠加，作为性能和组合能力样品。 | 画面层次清楚，性能可接受，不应因为叠加而全屏过曝。 |
| 019 Torus Dynamics Lab | 用可解释速度场研究环面体积中的闭合、准周期、编织和径向汇聚运动。 | 环面坐标、固定步长 RK4、Worker 重算、合并 LineSegments、流动 Shader、Fresnel 外壳和实验 HUD。 | 六种预设拓扑清晰不同；固定种子可复现；参数、暂停、URL 状态分享与相机交互有效。 |
| 020 Lights Beams | Paper 系列光束效果。 | Paper atom、实例化光束/辉光层。 | 光束有发射和扫动感，不是静态平面。 |
| 021 Rubiks Cube | Paper 系列魔方效果。 | Paper atom、3D 方块结构和旋转。 | 魔方立体结构清楚，旋转或状态变化可见。 |
| 022 Snake Grid | Paper 系列贪吃蛇网格效果。 | Paper atom、2D 网格和实例化状态更新。 | 蛇身、食物、网格状态可区分，动画不跳帧到空白。 |
| 023 Three Life | Paper 系列 cellular automaton。 | Paper atom、生命游戏状态迭代。 | 细胞出生/死亡持续变化，图案不会立即清空。 |
| 024 Three Particle | Paper 系列粒子效果。 | Paper atom、三维粒子层和相机/时间驱动。 | 多层粒子可见，有深度和运动差异。 |
| 025 3D ASCII Shape Renderer | 将 3D 几何投影成深度排序 ASCII 字符场。 | Canvas2D 采样 sphere/torus/helix，手写旋转矩阵和透视投影。 | 切换 shape 能看到明显不同轮廓；pointer 能改变视角；远近字符有透明度层次。 |
| 026 Code Meltdown | 源码字符像受热一样下坠、漂移、熔化。 | Canvas2D 字符网格、pointer heat field、湍流漂移和残影。 | pointer 附近字符应发热变色并偏移；cell size/turbulence 控制项可见。 |
| 027 Fluid Neon Shader | 全屏霓虹流体/等值线 shader。 | R3F fullscreen plane、fragment shader domain warp、fbm、pointer ripple。 | pointer 能弯曲流场；warp、line density 可从柔和油膜变成高对比线带。 |
| 028 Gold Triangle Particle Sphere | 复刻 TSL Gold Testing 的黑金品牌 hero。 | R3F 透明物理球体、Icosahedron wireframe、InstancedMesh 三角面片、程序化大陆状 mask、背景点线网络、HTML editorial overlay。 | 画面应明显是黑金品牌页，不是普通均匀粒子球；金色区域应成片且不规则。 |
| 029 Resonance Pendulum Lab | 不同自然频率摆锤在驱动频率下出现共振。 | R3F 多摆系统、受迫振子幅值公式、发光强度映射到共振幅值。 | 调节 drive frequency 时应看到不同摆锤成为最大摆幅；damping 增大后峰值变平。 |
| 030 Color Sorting Particles | 同屏比较 “How to sort colors?” 的四种答案。 | Canvas2D 粒子系统、四栏布局、HSL 色彩、不同 target layout、缓动收敛和点击重洗。 | 四栏必须同时显示；点击会重洗调色板；粒子平滑收敛。 |
| 031 ASCII Motion Cards | 复刻 ASCII cards 的白底极简产品卡片。 | Canvas2D 卡片排版、角标、底部 editorial UI、二进制 glyph 场、形状函数和慢速漂移。 | 字符图形要在卡片上半区形成轮廓；底部标题和按钮区域稳定。 |
| 032 Parametric Jellyfish | 复刻短公式生成的白色羽毛/水母状点阵。 | Canvas2D、原帖公式思路、数千到数万半透明点、黑底残影。 | 中心形体应像有脊柱和触须的羽毛/水母；trail 控制残影长度。 |
| 033 Geometric Breathing | 复刻 Soothe 类极简几何呼吸动效。 | Canvas2D、相位错开的节点、圆轨迹、弦线、慢速半径振荡。 | 效果应平静、慢速、黑底白线；不能变成随机粒子噪声。 |
| 034 Recursive Juggler | 复刻递归杂耍视觉悖论。 | Canvas2D stick figure、局部坐标系、抛物相位、递归绘制。 | 每个被抛出的球里应包含更小一层 juggler；循环运动稳定。 |
| 035 Trajectory Data Cinema | 复刻 Three.js AIS 船舶轨迹数据电影的发光路径感。 | Canvas2D 程序化航线、深色海图、coastline、时间窗 reveal、青色 glow。 | 应看到海岸线、地名、时间标签和大量发光轨迹。 |
| 036 Simulation Universe Visualizer | 把暗物质/模拟宇宙传播图转成 cosmic web + debugging HUD。 | Canvas2D 节点网络、扫描相位、网格 HUD、深色密度场。 | 应同时有宇宙网络和模拟界面感；scan phase 会扫亮节点。 |
| 037 Molten Relief | 用统一高度场生成持续生长与侵蚀的火热矿物浮雕。 | WebGL 高度场、Voronoi 细胞、岩层与晶体、差分法线、冷蓝窄边、阈值 Bloom。 | 红橙金色浮雕具有明确深度，蓝光只勾勒局部凸起边缘，三个预设均保持连续动画。 |
| 038 Marble Music Machine | 复刻 Three.js marble machine / Animusic 思路的机械节奏小样。 | R3F 金属板、轨道、bell、确定性时间轴驱动 marble 和发光撞击。 | 小球应沿轨道循环，bell 应按节奏发光；tempo 和 balls 有明显变化。 |
| 039 Air Surface Mouse | 把 WebGL + MediaPipe 手势空气表面改成鼠标/触控扰动版。 | R3F fullscreen shader、pointer uniform、折射网格、局部 ripple、空气膜高光。 | 鼠标移动处应产生可见折射和波纹；不需要摄像头授权。 |
| 040 Soft Botanical Compositor | 把 Blender Compositor 植物果实视觉转成浏览器可运行的柔和 CGI 小样。 | Blender Python 生成 GLB，R3F 加载资产，浏览器端控制 reveal、果实辉光、慢速摆动和 bloom。 | 应有白色枝条、粉色果实、柔和后期和慢速摆动。 |
| 041 Anime Lightning City | 把 Blender 动漫闪电 VFX 转成浏览器可预览的城市闪电小样。 | Blender Python 生成夜城 GLB，R3F 加载城市资产，浏览器端用 tube geometry 重建分叉闪电、闪白和 shake。 | 应有深蓝夜空、城市剪影、白蓝闪电柱和闪白冲击。 |
| 042 Probe Density Visual Control | 把 UE5 GPU Lightmass 手动 probe 控制思想转成采样密度调试图。 | Canvas2D 房间平面、probe 点、门洞/角落加密、leak risk overlay。 | 门洞和角落应出现更密 probe；leakView 打开时风险区域可见。 |
| 043 Metaball Liquid UI | 复刻 Liko Day9 的手机内黏性液体小球链。 | Canvas2D 手机构图、模糊/高对比 metaball 绘制、链式缓动、pointer pull、发光高光。 | 应有黑色手机面板、粉紫蓝发光软体小球，靠近时自然融合。 |
| 044 Prism Album Motion | 把 Liko Day7 的《月之暗面》棱镜动效转成浏览器专辑视觉小样。 | Canvas2D 暗场面板、白光入射、三角棱镜、彩虹色散光束、RGB 分离文字和底部控制条。 | 应能看到白光穿过棱镜后分散成彩虹；文字有色散偏移。 |
| 045 Lenticular Holo Card | 复刻 Liko Day6 的全息视差/光栅卡片。 | Canvas2D 倾斜卡片、彩虹 foil、斜向扫描线、鼠标横向映射表情帧和卡片视角。 | 鼠标横向移动会改变头像表情和 foil 高光。 |
| 046 ALife Particle Selection | 复刻自然选择粒子生命视觉。 | Canvas2D spatial grid 邻域查询、多物种吸引/排斥矩阵、局部采纳/突变规则、additive neon trails。 | 黑底应出现彩色微生物/菌落状聚团；粒子会按局部邻居改变 species。 |
| 047 Organic Seedform Motion | 复刻 Seedform 柔性生命初始形态。 | Canvas2D 粉色纸面、中心 seed core、放射纤维、噪声形变膜边界、深蓝墨色边缘和低速呼吸。 | 中心白色粒点、放射细线和深蓝边缘都应可见。 |
| 048 Contour Geometry Motion | 复刻黑底白线数学等高线。 | Canvas2D 预设几何块、嵌套 offset 线、圆角矩形/三角/胶囊/菱形组合、整体缓慢 breathing。 | 应看到近似方形构图内的多块几何等高线；线宽稳定、黑白单色。 |
| 049 WebGPU Physics Instance Lab | 复刻 GPU-side physics + instanced rendering 的球群视觉。 | Canvas2D 大量彩色实例、聚团/碰撞/指针排斥、右侧 debug 参数面板。 | 应有浅灰背景、彩色球群和 debug 面板；指针经过时球群被推开。 |
| 050 Weather Snow Scene | 复刻 SnowSystemThreeJS 的实时雪景模块。 | Canvas2D 雪地、埋雪车辆剪影、飘雪粒子、冰晶 sparkle 和参数面板。 | 应有深色冬季场景、积雪地面、车辆轮廓和持续飘雪。 |
| 051 Reference Camera Console | 复刻参考图驱动 AI 摄像头编辑控制台。 | Canvas2D 搜索栏、参考图 tray、live camera mock、AI generated overlay、右侧步骤控制面板。 | 应像本地摄像头 AI 编辑器；不请求真实摄像头；参数影响参考强度和 mask。 |
| 052 Hand-Pulled Thought Sculpture | 复刻手势驱动粒子毛发思想雕塑。 | Canvas2D 大量短线毛发、鼠标作为手势代理、悬浮团块、软阴影和控制条。 | 鼠标移动应拉动毛发团；下方软阴影和右上控制条可见。 |
| 053 Plasma Field Reconnection | 复刻磁重联科学场线视觉。 | Canvas2D 参数化横向/纵向场线、沿线粒子、中心 X 点 glow、NEON RECONNECT 面板。 | 青色和金色场线应在中心交汇；粒子沿线流动；面板参数可见。 |
| 054 Visual Inspector Control Layer | 复刻 R3F/WebGPU inspector 与 control panel。 | Canvas2D 红色玻璃 torus/blob、发光 Hello world 文本、FPS chip 和右侧 inspector 面板。 | 应体现“可调试视觉 playground”；Leva 参数改变形体、文字 glow 和旋转。 |
| 055 ASCII Mask Painter | 复刻 ascii-magic 的字符 mask 绘制工具。 | Canvas2D glyph field、可衰减 mask、鼠标刷子、字符密度映射和工具说明。 | 鼠标移动应局部增强 ASCII 字符密度；density/brushSize 控制明显。 |
| 056 Collective Trajectories | 复刻 Collective Trajectories 的轨迹累积生成艺术。 | Canvas2D 多 agent 轨迹、历史残影、对称复制、透明光迹叠加。 | 应看到轨迹逐渐累积成几何纹理；symmetry/trailFade 改变结构。 |
| 057 Sum Of Squares Proof | 复刻平方和公式视觉证明。 | Canvas2D 彩色等距方块、n^2 分组、phase 驱动从平方堆到矩形体的重组。 | 应能看到公式、彩色方块分组和几何重组过程；n/phase 控制证明步骤。 |
| 058 Cinematic Style Sequence | 复刻 Midjourney style reference 多图动画思路。 | Canvas2D 五格电影关键帧、燃烧摩天轮、火光、light trails、film grain。 | 应像 AIGC 电影风格序列板；speed/grain/lightTrails 改变动画质感。 |
| 059 Fibonacci Parastichy Sphere | 展示黄金角点阵中相邻 Fibonacci 螺旋族。 | 程序化球面点阵、parastichy 曲线 shader、图层切换和脉冲流动。 | 球面点阵与螺旋方向清晰；背面曲线被球体正确遮挡；参数切换不释放材质。 |
| 060 WebGL Fluid Simulation | 鼠标和触控驱动的彩色不可压缩流体。 | 原生 WebGL framebuffer ping-pong、速度/染料平流、旋度增强、压力投影、bloom 和 sunrays。 | 初始即有彩色流体；拖动产生连续旋涡和拖尾；重置、暂停、质量和 preset 控制可用。 |
| 061 Fourier Epicycle Curves | 以自动章节模式用周转圆链重建十种等弧长采样的星形、多边形和参数曲线。 | Canvas 2D、复数离散傅里叶变换、带符号频率旋转向量、可跳转离屏轨迹缓存和章节时间轴。 | 底部图例可手动切换或自动播放；拖动时间轴会重建对应轨迹，增加分量后尖角逐渐清晰。 |
| 062 Every Curve Hiding Inside a Circle | 在深色数学展厅中串联单向量圆、反向向量、内外滚圆、trochoid 和 Fourier 轮廓。 | Canvas 2D、无滑动滚圆参数方程、有理半径比闭合周期、复数 Fourier 系数和可拖动时间轴。 | 11 个不重复章节可自动或手动切换；R/r/d、辅助圆、完整轨迹和 Fourier 分量调整均实时生效。 |
| 063 Double Pendulum Wave | 让真实双摆的运动历史逐渐展开为彩虹波浪、编织丝带和碗状生成艺术。 | 固定步长 RK4、TypedArray Ring Buffer、自定义 Ribbon BufferGeometry、GLSL HSV 映射、白色路径粒子和 Bloom。 | 两段白色摆杆运动连续；轨迹长期运行不增长内存；参数、暂停、重置、随机化、清轨迹和全屏均可用。 |
