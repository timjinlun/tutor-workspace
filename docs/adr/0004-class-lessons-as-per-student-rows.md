# ADR-0004 · 班课：按人落记录，用 groupId 归组

日期：2026-09-12 · 状态：已采纳

## 背景

老师有时几个学员一起上（小班）。需要：一次点名、各扣各的课时、每人可以有不同余额和缴费，缺席扣不扣由老师定。

## 备选

- A. 一节班课一条 `Lesson`，里面存 `studentIds[]` 和每人的出勤。
- B. 班课仍然按人落 `Lesson`（每人一条），同一次的记录共享 `groupId`；`Class` 只描述成员、定价、缺席规则。

## 决定

选 B。

- `Class { name, courseId, studentIds, pricePerUnit?, deductOnAbsence, active }` 是"一群人 + 定价 + 规则"，不存任何上课事实。
- 固定课表里的班课模板带 `classId`，`lessonsOn` 在当天为每个在读成员生成一条虚拟记录，`groupId = grp:<templateId>:<date>`。
- 打卡走 `completeClass(items, attendance)`：到场 → `done`；缺席 → 按 `deductOnAbsence` 记 `done`（attendance=absent）或 `cancelled`。
- UI 用 `groupItems()` 把一天的记录折成组，班课一组一张卡；一对一每节自成一组。

## 后果

- 余额、确认收入、家长报告、按学员考勤表一行代码都不用改，因为它们只看 `Lesson`。
- 撤销打卡仍然按人（`undoLesson`），不提供"整组撤销"，避免误伤。
- 改期暂不支持整组（会破坏 groupId 一致性），要改期先取消再排。
- 免费版上限（3 个班、每班 8 人）在 entitlements 里，store 的 `addClass / updateClass` 检查。
- 代价：一次班课在 `lessons` 表里是 N 行。老师规模下（几十人）可以忽略。
