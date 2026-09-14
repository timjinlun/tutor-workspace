# Student Dossier Implementation Plan

**Goal:** 轻量学员档案：资料编辑与标签筛选、追加学习记录、双 Tab、有限摘要与历史弹窗、可编辑续费文案、家长报告复用记录。

**Architecture:** core 保存模型与纯规则；store 的独立 action factory 注入读取/提交端口；electron/db/collections 声明新增持久化集合，仍使用事务保存和现有备份。ui/modules 下每个模块只暴露 index.ts，不依赖兄弟模块；features/students 负责聚合，通过 props/callback 连接模块。

**Tech Stack:** React / TypeScript / Zustand / SQLite / Vitest / Electron。

## 1. 模型、操作与旧数据
- 新建 core/student-profile/{types,selectors,commands}.ts、core/learning-records/{types,commands,selectors}.ts。
- Student 增加可选资料字段，State 增加 learningRecords；normalizeState 为旧数据补齐并清理无效关联。
- 新建 store/student-profile.ts、store/learning-records.ts，以注入 getState/commit 的方式聚合至 store/index.ts。
- 新建 electron/db/collections/student-dossier.ts，为记录建独立表和 studentId/date 索引；无旧表覆盖迁移。
- 测试：标签 AND 筛选、混合授课标签、输入校验、记录 CRUD、关联校验、旧存档与 SQLite 重开/备份。

## 2. 独立 UI 模块
- ui/modules/student-directory：搜索、课程/授课方式/自定义标签筛选、排序与折叠已结课。
- ui/modules/student-profile：姓名/课时摘要、资料编辑；内部备注不进报告。
- ui/modules/learning-records：最近 3 条、自由文字编辑、日期/课程关联、默认内部记录。
- ui/modules/student-ledger：最近 3 次上课、2 次缴费、完整历史、缴费弹窗。
- ui/modules/renewal：文案预览编辑，复制成功/失败反馈；不发送消息。
- ui/primitives/HistorySheet.tsx：宽弹窗、月份筛选、每页 12 条与滚动边界。
- features/students：只组合以上模块、连接已有记课/撤销/报告；不得复刻模块业务。

## 3. 报告与边界
- core/report.ts 只聚合所选日期范围内标为可用于家长反馈的学习记录，不自动生成进步结论。
- ParentReportSheet 复用现有入口，支持起止日期、可编辑草稿与复制反馈。
- scripts/check-module-boundaries.mjs 校验模块公开入口、兄弟模块隔离及 layer import；挂入 lint。
- docs/architecture/student-dossier.md 列出 package 边界、数据流、字段兼容与验证方式。

## 4. 验证与交付
- npm test、npm run typecheck、npm run lint、npm run build。
- 隔离临时 SQLite 的 Electron 验收：编辑/筛选/新增记录/关联评语/历史月份分页/报告隐私/复制/持久化；截图检查窄窗与深浅色。
- 不触碰正式学员数据；本次实施不自动发布 Release。
