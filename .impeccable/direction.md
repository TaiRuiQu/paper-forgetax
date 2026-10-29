# 像素工坊：场景即界面

Target: `client/index.html`（游戏工坊、短开场与首日引导）
Related styles: `client/css/style.css`, `client/css/workshop.css`
Mode: Experience
Build path: code（用户选择 code-first）
Platform scope: desktop browser only；用户明确要求不考虑手机版。

## Direction contract

**THESIS:** 让玩家进入一间持续运作的 2D 像素铁匠工坊。用户确认的连续场景优先于目录外观；拒绝三栏网页面板加独立底栏的布局。

**OWN-WORLD:** 炭黑石墙、木台、铁器、黄铜与余烬构成同一房间。Fusion Pixel 承载中文，Press Start 2P 承载拉丁像素字与数字。640×360 背景与 240×160 原生透明铁砧按邻近采样显示；实体剑和程序图标保持独立。

**STORY:** 先用简短开场说明玩家是被巨龙征税的铁匠与每日目标，再通过真实拿剑、加热、挥锤、献贡、敲铃和次日结算学会第一天。允许跳过引导，不改变随机概率，不引入战斗。

**FIRST VIEWPORT:** 整屏为固定镜头工坊，中央前景铁砧与剑最大；炉火操作贴左墙，剑架与库存在左下工作台；遗物商亭在右上，贡台与铃在右下。状态与概率在中央下方，主挥锤按钮在其下；顶部只保留契约、贡额、资源和菜单。首日目标小卡在左上。命名交互“真实挥锤”：前景锤击、结果火花与局部震动；炉光与引导轮廓采用像素步进节奏，减少动态设置收敛效果。

**FORM:** 固定镜头的像素冒险舞台；原候选序列 index 7；seed key `0e191bcc`。人类钉定的连续 2D 像素工坊与 code-first 为最终权威。目录挑战保留密度纪律、清晰状态与物件承载操作，不移植其外观。

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Acceptance evidence and limits

桌面截图：`.impeccable/review/desktop.png`、`desktop-1280.png`；开场：`intro.png`；次日完成：`tutorial-day2.png`。鼠标拖放、Space/H/E、真实首日结算、存档和减少动态沿用现有能力。桌面 1280×720 与当前窗口中控制可达；紧凑桌面修正保留概率标签空间和资源名称。

独立 finish review 先给出 fix；修正后确认这两项已解决，结论为 limited fix-verdict scope 内 ship。详见 `review/verification.md`。这不证明原作全等，也不把原有小屏 CSS 纳入本次验收。

`DESIGN.md` 与 `.impeccable/design.json` 记录落地视觉系统。生成背景的提示词 sidecar、PNG 内嵌提示词与 `docs/audit/generated-assets.md` 记录栅格来源。
