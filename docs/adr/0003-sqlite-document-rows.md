# ADR-0003 · SQLite 存储：一实体一表，JSON 文档 + 索引列

日期：2026-09-12 · 状态：已采纳

## 决定

每种实体一张表，结构统一：

```sql
CREATE TABLE <entity>(
  id TEXT PRIMARY KEY,
  k1 TEXT, k2 TEXT,          -- 该实体最常按它查的键（如 student_id、date），带索引
  data TEXT NOT NULL,        -- 完整 JSON
  updated_at TEXT NOT NULL
);
```

审计流水 `audit_log`、快照 `snapshots`、元信息 `meta` 是正规列表。

## 为什么不是全列展开

v2 是全列展开，每加一个字段就要迁移。v3 前期字段会频繁变，JSON 列让 schema 变更只发生在 `core/types.ts`；真正需要 SQL 过滤的键（学员、日期）单独提列并加索引，查询能力不丢。

## 代价

不能在 SQL 里直接对 JSON 内字段做聚合（SQLite 的 `json_extract` 可以，但慢）。当前数据量（一个老师，几千行）下不是问题。若将来做多老师团队版，再把热点字段提列。
