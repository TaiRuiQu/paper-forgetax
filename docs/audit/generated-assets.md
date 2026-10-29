# 生成素材记录

使用内置 `image_gen`，未使用 CLI/API fallback。输出为项目实际素材。PNG 原生透明通道保留；仅用 ffmpeg 邻近采样缩小，未用抠色模拟透明。

| 素材 | 保存路径（项目内） | 导出规格 | 精确提示词 |
| --- | --- | --- | --- |
| 连续像素工坊 | `client/assets/scene/workshop-pixel.webp` | 640×360，无损 WebP | [背景提示词](workshop-pixel-prompt.txt) |
| 前景像素铁砧 | `client/assets/scene/anvil-pixel.png` | 240×160，RGBA PNG | [铁砧提示词](anvil-pixel-prompt.txt) |

背景同时用于开场、登录/存档场景及游戏工坊。铁砧作为独立前景与程序渲染的剑、锤子和粒子叠放。所有引用均在工作区内，不依赖 CODEX_HOME 的原始输出路径。原有 SVG 保留供剑阶、遗物、图鉴等使用。
