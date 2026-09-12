# 独立老师工作台 · Tutor Workspace

给独立老师的 macOS 工作台：今天几节课、谁、几点、上完点一下就记好。学员、课表、缴费、收支都在本机 SQLite 里，不上传任何服务器。

A local-first macOS app for independent tutors. React + TypeScript + Electron, SQLite on your own machine. Chinese UI.

<p align="center"><img src="docs/screenshots/today.png" width="880" alt="今天"></p>

## 它怎么用

打开就是**今天**：

- 有固定课表的老师：每周设一次，当天的课自动出现，上完点「上完了」就盖章
- 没有固定课表的老师：右上角「记一节课」，选学员，课程和单价自动带出，三秒完成
- 忘了记？「今天」会根据历史推断"张明通常周五 16:00 上课"，一键记上
- 该提醒续费的学员、今天到期的待办，都在同一屏

盖了章的课不能随手改：撤销要二次确认，并且写进流水。

<p align="center">
<img src="docs/screenshots/students.png" width="430" alt="学员档案">
<img src="docs/screenshots/schedule.png" width="430" alt="课表">
</p>

## 数据

| 存哪 | `~/Library/Application Support/独立老师工作台/data/工作台.db` |
|---|---|
| 怎么保 | 每次改动自动写入 · 每小时自动快照（留 30 份）· 设置里一键备份 / 导出 JSON |
| 流水 | 每次打卡、撤销、缴费都进 `audit_log`，只增不删 |

标准 SQLite 文件，任何工具都能打开。

## 外观

跟随系统深浅色；强调色三选一：珊瑚、靛蓝、跟随 macOS 系统强调色。侧栏是原生毛玻璃。

<p align="center">
<img src="docs/screenshots/today-dark.png" width="430" alt="深色">
<img src="docs/screenshots/today-indigo.png" width="430" alt="靛蓝">
</p>

## 开发

```bash
npm install
npm run dev        # 热更新
npm test           # 领域层单测（vitest）
npm run lint       # 含模块边界检查
npm run pack       # 打包到 dist/
```

需要 Node ≥ 24（数据层用内置 `node:sqlite`，零 native 依赖）。

## 架构

```
src/core           领域模型 + 业务规则，纯函数，零 IO        ← 单测在 tests/
src/entitlements   免费 / 商业版边界，唯一的"能不能"出口
src/data           Repository 接口 + SQLite / localStorage 实现
src/platform       系统强调色、剪贴板、文件对话框，接口化
src/store          状态 + Command，审计流水在这里产生
src/ui/primitives  设计系统组件，无业务
src/ui/widgets     跨功能复用的组合组件
src/ui/features/*  一个功能一个目录，互相不 import
electron/          主进程、preload、SQLite
```

依赖只能向内，由 `eslint-plugin-boundaries` 强制。加一个功能 = 新建一个 feature 目录 + 在 entitlements 登记 + 注册路由，不改别处。决策记录在 [`docs/adr/`](docs/adr/)。

## 免费版与商业版

开源的是独立老师版。边界定义在 `src/entitlements/index.ts`：老师最多 5 位；招生看板、报告导出、文件附件、转介绍自动结算属于商业版。挪一格改一行，不碰业务代码。

## 路线

- [x] 今天 · 学员 · 课表（固定周课表）
- [ ] 课表月视图（考勤表）
- [ ] 收支图表、支出录入
- [ ] 家长报告、月度经营报告
- [ ] 成绩卡（一键生成分享图）
- [ ] 潜在学员、资料、转介绍
- [ ] iOS / iPad（Tauri 2，同一套 React 代码）

## License

MIT © 2026 Tim
