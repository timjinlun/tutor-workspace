# 教学管理模块边界

这次调整只重组展示和编辑入口，不增加业务数据表，不改变已有课程、班级、老师的持久化格式。

## 分层

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 实际数据 | Electron SQLite / 现有 repository | 保存既有 Course、Class、Teacher 集合 |
| 数据结构 | `src/core/types.ts` | 保留已有领域类型与旧数据兼容 |
| 输入规则 | `src/core/catalog-forms.ts` | 纯函数解析课程与老师草稿，拒绝无效数值 |
| 数据操作 | `src/store/index.ts` 现有 actions | 更新状态、版本额度检查、持久化；UI 不直接读写数据库 |
| 独立功能包 | `src/ui/modules/course-catalog/` | 课程摘要、课程编辑、默认课时规则 |
| 独立功能包 | `src/ui/modules/class-management/` | 班级摘要、成员选择、定价、缺席规则与授课老师 |
| 独立功能包 | `src/ui/modules/teacher-management/` | 老师摘要、姓名、颜色与课时费 |
| 展示原语 | `src/ui/primitives/SetupPanel.tsx` | 无业务的标题、操作区、内容与辅助说明样式 |
| 聚合页 | `src/ui/features/courses/CoursesPage.tsx` | Tabs、注入命令、跨模块关联保护及删除确认 |

模块通过各自 `index.ts` 暴露公开组件。不相互 import，也不直接依赖 store、platform 或数据库；使用项目现有模块边界检查约束。

## 交互约定

- 三个 Tab 始终并列可达；支持左右方向键和 Home / End。
- 列表只读，编辑弹窗使用本地草稿，保存后才调用操作层。取消不改变数据。
- 课程显示每节费用、时长、扣课时与在读人数；默认课时长度在「课时规则」。
- 班级编辑保留已选的结课学员，避免修改单价时顺带丢失成员；可搜索成员。
- 免费额度来自 entitlement，而不是 UI 写死。恢复班级也检查开课数量限制。
- 本人称呼与设置同步。合作老师费率沿用现有计算方式，会影响历史月份应付统计，编辑时明确提示。
- 删除需确认；关联班级的课程不能直接删除。历史打卡数据保留。

## 验证

- `npm test`：包括输入校验、原有领域/存储测试与自定义图片 CSP 回归。
- `npm run typecheck`、`npm run lint`：类型和模块边界。
- `npm run build && node_modules/.bin/electron scripts/verify-teaching-layout.cjs`：使用临时目录的示例数据检查编辑、取消、班级成员/缺席规则、老师结算、本人称呼、键盘 Tabs、920px 深色布局、删除保护和重启持久化。不会使用实际用户数据库。
- 截图与结果在 `docs/qa/teaching-layout/`。
