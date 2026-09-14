# 学员档案 package 边界

## 产品范围

默认两个 Tab：学习记录、课时与缴费。学习记录最多展示最近 3 条且每条最多 3 行；上课记录最多 3 条；缴费最多 2 条。所有完整历史均使用月份筛选、每页 12 条、限制高度的宽弹窗，不在主页面追加无限列表。

资料可编辑；名单支持课程、实际授课方式与自定义标签的 AND 组合筛选。授课方式不会仅凭“选了某门课”猜测；有一对一排课/上课关系才显示 1 对 1，有小班关系才显示小班，混合授课可同时出现。

## 分层目录

```text
src/core/
  student-profile/
    types.ts         可编辑资料输入契约
    selectors.ts     自动标签、搜索和组合筛选（纯函数）
    commands.ts      编辑校验、不可变更新（纯函数）
  learning-records/
    types.ts         学习记录实体和输入契约
    selectors.ts     学员记录查询、旧数据规范化
    commands.ts      新增/编辑与学员、课程关联校验
  report.ts          聚合允许分享的观察与课时事实，输出报告文本
  types.ts           全局 State 聚合及兼容旧存档入口
src/store/
  student-profile.ts 独立资料 action factory
  learning-records.ts 独立记录 action factory
  index.ts           注册 action、提交状态并调用统一 Repository
src/data/
  repository.ts      load/save/audit 持久化端口
  electron.ts        IPC 适配器
  localStorage.ts    浏览器适配器，JSON 自动携带新增集合
electron/db/
  collections/student-dossier.ts  learningRecords 集合与索引声明
  store.ts                       SQLite 事务、快照、备份
src/ui/modules/
  student-directory/  名单/拖动/筛选控件
  student-profile/    摘要、资料编辑、新建学员
  learning-records/   记录摘要、编辑、完整记录
  student-ledger/     课时与缴费摘要、完整历史、缴费表单
  renewal/            可编辑续费文案、复制结果反馈
  parent-report/      时间选择、可编辑报告、复制结果反馈
src/ui/primitives/
  HistorySheet.tsx    通用月份筛选与分页弹窗，不认识业务实体
src/ui/features/students/
  StudentsPage.tsx    聚合层，计算 view props、连接模块 callbacks
```

每个 UI module 的公开入口是 `index.ts`。模块之间不互相 import；模块不读取 Store、平台、IPC、数据库，而是接收 props 和 command/copy 回调。features 聚合模块；既有 ReportSheets 作为报告容器注入 State 和复制能力。新增 UI 模块没有网络请求和新依赖。

## 数据与操作契约

- `StudentDetails`：年级、学校、目标、家长称呼、联系方式、沟通偏好、自定义标签；旧 Student 身份、排序和归档字段保持原义，旧备注保留。
- `LearningRecord`：独立 ID、studentId、日期、正文、可选 lessonId、visibility、createdAt、updatedAt。自由文字最多 4000 字；保存要校验学员存在、日期有效、关联的是该学员已完成课程。
- action factory 接收 `read(): State` 与 `commit(Partial<State>)`，可以不启动 Zustand/React 就测试。时间与 ID 在操作层生成；业务计算不访问文件系统。
- 资料编辑只更新学员集合，不改历史课价、余额或上课事实。学习记录只更新自身集合。删除学员时聚合操作同时清理其学习记录；结课保留全部历史。
- 历史课程撤销后观察保留并提示关联课程已撤销，再编辑时可解除关联。导入时不存在或跨学员的课程链接被移除，记录正文保留。

## SQLite 与兼容

`students` 已是 JSON 文档表，新资料字段无需改表；新增 `learningRecords` 文档表，索引键为 studentId 和 date。`CREATE TABLE IF NOT EXISTS` 追加集合，不覆盖旧表，保留现有 schema/version 3 的文档扩展方式。

`normalizeState` 对旧存档补空记录数组、清理标签，对非法记录与孤儿关联做规范化。现有 SQLite 事务保存、启动快照、JSON 导入导出和完整数据库备份继续覆盖新增集合。

## 反馈与隐私

新记录默认 `internal`。只有主动勾选“可用于家长反馈”的记录，才进入当前学员、选定日期内的报告；学员内部备注、联系方式、未标为可分享的记录、旧课程 note 均不自动进入报告。不会推断或编造进步结论，不自动发送消息。

报告默认按月，保留原 `reports.customRange` 权益控制自选范围；本次没有改变商业版边界。时间切换会重新生成草稿，有可见提示；老师可修改全文后复制。续费提醒同样先预览编辑，再复制，成功与失败均有反馈。

## 边界与验收

- `npm run lint` 首先执行 `scripts/check-module-boundaries.mjs`：检查 module 公共入口、兄弟模块隔离、注入端口和向内依赖。负向测试确认违规导入确实失败。
- `tests/student-dossier.test.ts`：领域编辑、组合标签、记录校验、旧存档。
- `tests/student-dossier-storage.test.ts`：旧 SQLite 追加集合、重开、备份/JSON 往返、报告隐私、归档/删除。
- `scripts/verify-student-dossier.cjs`：真实生产 Electron + 临时独立 SQLite + 虚构学员，验证编辑、筛选、摘要上限、历史筛选分页、关联评语、复制成功/失败、报告编辑隐私、重载、窄窗深色。
- `docs/qa/student-dossier/`：可复核截图和 evidence.json；测试不操作正式数据。

已知既有诊断：src/index.html 的首帧主题内联脚本被现有 CSP 拦截；ESLint boundaries 配置有迁移警告。本次不修改 CSP 或全项目规则版本，报告中单独保留诊断。新增模块边界由独立脚本强制执行。
