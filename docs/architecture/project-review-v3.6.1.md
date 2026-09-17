# 记一课 v3.6.1 项目结构与架构审查

> 审查基线：v3.6.1 发布代码，2026-09-17。评分面向当前规模的本地优先独立老师桌面应用，不按大型多人 SaaS 的要求机械扣分。

## 1. 系统全景

记一课是一个本地优先 Electron 桌面应用。React 负责界面，Zustand 负责应用状态和命令编排，纯 TypeScript 领域函数处理排课、打卡、课时、收入与报告，Electron 主进程通过受限 IPC 桥接 SQLite、文件对话框和本机能力。

```text
用户操作
   │
   ▼
React feature / module / widget
   │  只调用具名 action
   ▼
Zustand Store（命令编排、持久化触发、审计触发）
   │                 │
   │                 └── Core 纯函数（业务规则、selector、计算）
   ▼
Repository 接口
   ├── Electron Adapter ── preload IPC ── Electron 主进程 ── SQLite / 文件系统
   ├── localStorage Adapter（浏览器退化运行）
   └── Memory Adapter（测试）
```

核心运行边界：

- Renderer 没有 Node 权限，`contextIsolation` 与 `sandbox` 开启。
- UI 不直接写 SQLite，也不直接修改领域状态。
- 业务计算集中在纯函数层，便于单元测试。
- macOS 与 Windows 共用业务代码，平台差异收口在 Electron 与 platform 层。

## 2. 目录结构

```text
.
├── electron/                         桌面主进程与本机能力
│   ├── main.ts                       窗口、菜单、IPC、生命周期组合根
│   ├── preload.ts                    Renderer 可调用的最小桥
│   ├── datadir.ts                    稳定数据目录与历史目录迁移
│   ├── poster-share.ts               临时局域网海报服务
│   ├── system-appearance.ts           macOS / Windows 系统强调色
│   └── db/
│       ├── store.ts                  SQLite 事务、快照、备份、审计
│       ├── migrate-v2.ts             v2 → v3 迁移
│       └── collections/              文档集合及索引键定义
├── src/
│   ├── app/App.tsx                   路由与页面组合根
│   ├── core/                         零 IO 的领域模型与业务规则
│   │   ├── types.ts                  核心实体、默认值、数据归一化
│   │   ├── lesson.ts / klass.ts      一对一和班课生命周期
│   │   ├── finance.ts / report.ts    余额、收入、报告
│   │   ├── student-profile/          学员档案命令与 selector
│   │   ├── learning-records/         学习记录命令与 selector
│   │   └── jar-*.ts                  储蓄罐计算、网格与物理
│   ├── store/
│   │   ├── index.ts                  应用命令、状态提交与持久化编排
│   │   ├── student-profile.ts        学员档案 action 注入
│   │   └── learning-records.ts       学习记录 action 注入
│   ├── data/                         Repository ports 与 adapters
│   ├── entitlements/                 免费版 / 商业版能力策略
│   ├── platform/                     壁纸、剪贴板、文件等平台抽象
│   └── ui/
│       ├── features/                 页面级功能
│       ├── modules/                  可组合业务模块，仅暴露公共入口
│       ├── widgets/                  跨功能组合组件
│       ├── primitives/               无业务基础组件
│       └── styles/                   token、基础样式与背景系统
├── tests/                            领域、存储、边界与平台单元测试
├── scripts/                          构建后 Electron 流程与视觉检查
├── docs/
│   ├── adr/                          架构决策记录
│   ├── architecture/                 模块设计与本审查
│   ├── qa/                           视觉和行为证据
│   └── windows.md                    Windows 使用、开发与验收范围
├── build/                            图标与签名后处理
└── .github/workflows/build.yml       macOS / Windows 构建和 Release
```

## 3. 关键功能及代码片段

以下片段是实际实现的精简摘录，省略了与主题无关的字段。

### 3.1 Repository：让业务层不依赖 SQLite

```ts
export interface Repository {
  load(): Promise<State | null>;
  save(state: State): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
  recentAudit(limit: number): Promise<AuditEntry[]>;
}

export function selectRepository(): Repository {
  if (typeof window !== "undefined" && window.tw) return electronRepository();
  return localStorageRepository();
}
```

价值：同一套 store 可以运行在 Electron、浏览器退化模式和内存测试中。新增云端同步时也有明确的 adapter 接入点，但需要先定义冲突与一致性语义。

### 3.2 Command + 纯领域函数：打卡时锁定历史价格

```ts
export function completeLesson(state: State, item: DayItem, at = new Date().toISOString()): LessonChange {
  const base = stripVirtual(item);
  const record: Lesson = item.virtual
    ? { ...base, id: uid("l"), status: "done", doneAt: at, createdAt: at }
    : { ...base, status: "done", doneAt: at };
  const lessons = item.virtual
    ? [...state.lessons, record]
    : state.lessons.map(l => l.id === item.id ? record : l);
  return { lessons, audit: entry("lesson.done", "…", record, at) };
}
```

课程记录保存当时的 `units` 与 `price`，以后修改课程价格不会篡改历史收入，这是账务完整性的正确选择。

### 3.3 班课建模：一场教学，多条学员账

```ts
return classMembers(state, cls).map(student => ({
  id: uid("l"),
  studentId: student.id,
  classId: cls.id,
  groupId,
  units: course?.unitsPerLesson ?? 1,
  price: classPrice(state, cls),
  attendance: "present",
  status: "done",
}));
```

每位学员各有一条 Lesson，使用 `groupId` 归为同一场班课。这样余额、收入和学员报告仍能复用一对一的计算模型，避免在所有报表里增加“班课特例”。

### 3.4 收入与到账分离

```ts
export function confirmedIncome(state: State): number {
  return state.lessons
    .filter(l => l.status === "done")
    .reduce((sum, l) => sum + l.units * l.price, 0);
}

export function cashInMonth(state: State, ym: string): number {
  const pay = state.payments
    .filter(p => monthKey(p.date) === ym)
    .reduce((total, p) => total + p.amount, 0);
  const other = state.otherIncomes
    .filter(p => monthKey(p.date) === ym)
    .reduce((total, p) => total + p.amount, 0);
  return pay + other;
}
```

确认收入回答“本月实际完成了多少教学价值”，到账回答“本月实际收到了多少钱”。两个口径没有混用。

### 3.5 SQLite 文档集合 + 单次保存事务

```ts
save(state: StateLike) {
  this.db.exec("BEGIN IMMEDIATE");
  try {
    for (const [name, keys] of Object.entries(COLLECTIONS)) {
      this.db.exec(`DELETE FROM ${name}`);
      const insert = this.db.prepare(
        `INSERT INTO ${name}(id,k1,k2,data,updated_at) VALUES(?,?,?,?,?)`,
      );
      const rows = (state[name] as Row[] | undefined) ?? [];
      for (const row of rows) {
        const k1 = keys[0] ? str(row[keys[0]]) : null;
        const k2 = keys[1] ? str(row[keys[1]]) : null;
        insert.run(String(row.id), k1, k2, JSON.stringify(row), now);
      }
    }
    // settings 使用同一事务写入；此处省略具体循环。
    this.db.exec("COMMIT");
  } catch (error) {
    this.db.exec("ROLLBACK");
    throw error;
  }
}
```

当前规模下，一实体一行 JSON 文档兼顾演进速度与可检查性。完整 state 保存使用事务，不会让不同集合停留在半新半旧状态。

### 3.6 数据恢复：WAL、快照、在线备份与迁移

```ts
this.db.exec("PRAGMA journal_mode = WAL");

snapshot(state, reason) {
  insertSnapshot(JSON.stringify(state), reason);
  keepLatest(30);
}

backupTo(path) {
  return this.db.backup(path);
}
```

应用还包含 v2 数据读取和归档、旧目录迁移、孤儿 WAL 修复、导入前快照及 JSON 导入导出。自动快照位于同一个数据库内，因此只能应对误操作，不能替代异地备份。

### 3.7 Entitlement Policy：版本边界只有一个出口

```ts
export function createEntitlements(tier: Tier): Entitlements {
  return {
    tier,
    can: feature => RANK[tier] >= RANK[FEATURE_TIER[feature]],
    limit: key => LIMITS[tier][key],
    check(key, count) { /* 返回明确结果与原因 */ },
  };
}
```

UI 只问 `can`、`limit` 或 `check`，不会散落 `if (isPro)`。以后调整商业边界时不必修改业务规则。

### 3.8 安全 IPC Bridge

```ts
new BrowserWindow({
  webPreferences: {
    preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
});

contextBridge.exposeInMainWorld("tw", {
  data: { load, save, backup, exportJSON, importJSON },
  system: { setAppearance, openExternal },
});
```

Renderer 只能调用白名单能力，外链限制为 HTTP(S)，比直接开放 Node 或整个 IPC 通道安全。

## 4. 使用的设计模式

| 模式 | 项目中的位置 | 作用 |
|---|---|---|
| Layered Architecture | `core → store → data/platform → Electron/UI` | 控制依赖方向，隔离业务与框架 |
| Repository | `src/data/repository.ts` | 把状态读写与存储实现分开 |
| Strategy | `selectRepository`、免费/商业 tier | 按环境或版本选择实现 |
| Adapter | Electron、localStorage、memory repository | 把外部能力适配为统一接口 |
| Command | Zustand 中具名 action、core command | 所有写操作有明确入口和语义 |
| Selector / Query Object | `finance.ts`、各模块 selectors | 集中派生数据，保持 UI 简单 |
| Composition Root | `main.ts`、`App.tsx`、`CoursesPage.tsx` | 在边界处组装依赖和模块 |
| Policy Object | `Entitlements` | 集中表达权限与数量限制 |
| Observer | Zustand 订阅、系统主题事件 | 状态或系统变化驱动界面更新 |
| Snapshot | SQLite snapshots、备份 | 为误操作和迁移提供恢复点 |
| Anti-corruption Layer | preload + platform | 防止 Electron API 渗入业务/UI |

这些模式大多自然服务于问题，没有为“使用模式”而制造抽象。

## 5. 工程评分

| 维度 | 分数 | 判断 |
|---|---:|---|
| 可维护性 | 8.2 / 10 | 领域逻辑纯函数化、模块边界有自动检查、ADR 与测试齐全。扣分点是 `store/index.ts` 已达 400 多行，`electron/main.ts` 同时承担窗口、菜单、数据对话框和 IPC。 |
| 可扩展性 | 8.4 / 10 | Repository、Entitlements、功能模块和平台层让新增存储、功能或平台有清晰入口。集中式 `State` 与整库集合重写在数据量或多端同步场景下会成为瓶颈。 |
| 代码可读性 | 8.1 / 10 | 类型、业务命名、中文注释和小型领域函数表现好；复杂物理模块与个别大型页面/Store 需要继续拆分。 |
| Design Patterns | 8.6 / 10 | Repository、Strategy、Adapter、Command、Policy、Selector、Composition Root 使用得当，抽象与规模基本匹配。 |
| 最佳实践 | 7.9 / 10 | TypeScript strict、Electron 安全隔离、CI、单元测试、真实 Electron smoke、跨平台构建均已具备。主要缺口是安装包未签名、Windows 安装器尚无人工验收、ESLint boundaries 配置存在升级警告。 |
| 数据完整度 | 7.7 / 10 | 有 WAL、事务、快照、在线备份、迁移、归一化和审计；历史价格锁定正确。扣分点是状态保存与审计写入不是同一事务，Renderer 端有 150ms 防抖保存窗口，自动快照与主库同盘，导入格式校验仍偏宽松。 |
| 综合 | **8.2 / 10** | 已是结构清楚、可以持续发布的成熟个人产品代码库；下一阶段重点应从“继续加功能”转向强化写入一致性、拆分组合根和正式签名发布。 |

## 6. 数据完整性判断

### 已经做对的部分

- Lesson 在发生时锁定课时、价格、老师、考勤与完成时间，避免历史账随课程设置改变。
- 一次 state 保存由 SQLite 事务包住，失败会回滚。
- WAL 降低崩溃导致的损坏风险，`PRAGMA quick_check` 已用于交付验证。
- 启动、定时、导入前和迁移时创建快照，且只保留最近 30 份，避免无限增长。
- SQLite 在线备份比运行时直接复制主文件安全。
- `normalizeState` 为旧数据补默认值并清理无效关联；v2 有显式迁移与归档。
- 删除老师或班级时保留已经发生的课程记录，符合历史事实不可被配置删除的原则。

### 当前风险

1. **状态与审计非原子。** Store 先异步发送审计，再由 150ms 防抖保存 state；进程在两者之间退出时，两者可能不一致。
2. **短暂未落盘窗口。** 高频操作靠防抖合并写入，正常关闭通常能完成，但异常退出存在最后一次操作尚未持久化的可能。
3. **快照同盘。** 数据库文件丢失或磁盘损坏时，内嵌快照也一起丢失。
4. **导入校验偏宽。** 主进程只确认 JSON 顶层是对象，真正的兼容处理依赖 Renderer 的归一化；缺少独立 schema 与错误报告。
5. **文档行没有数据库外键。** 关联完整性主要由命令和 `normalizeState` 保证，外部工具直接改库时 SQLite 不会替应用拦截错误关联。

### 建议优先级

| 优先级 | 建议 | 收益 |
|---|---|---|
| P0 | 增加一个主进程 `commit(state, audit[])` IPC，在同一 SQLite 事务中保存状态和审计 | 消除最关键的一致性裂缝 |
| P0 | 在 `before-quit` 主动 flush 待保存状态，并增加异常退出恢复测试 | 缩小最后 150ms 丢写窗口 |
| P1 | 为 JSON 导入增加版本化 schema 校验、错误路径和预览摘要 | 防止格式错误或部分数据静默丢失 |
| P1 | 提供快照恢复界面，并引导定期把备份复制到其他介质 | 让已有恢复能力真正可用 |
| P1 | 将 `store/index.ts` 按 lesson、catalog、finance、lead 拆成 action slice | 降低冲突与认知负担 |
| P2 | 将 `electron/main.ts` 的数据对话框、IPC 注册、菜单拆成独立模块 | 降低平台入口复杂度 |
| P2 | 迁移 ESLint boundaries 新配置格式 | 消除工具升级风险和警告噪声 |
| P2 | 配置 Apple 与 Windows 正式签名并增加安装/升级验收 | 提升普通用户安装成功率 |

## 7. 发布判断

v3.6.1 的领域测试、类型检查、模块边界检查、macOS/Windows 打包及真实 Electron 流程均有证据支持。GitHub Windows runner 会再次执行相同检查。当前最大限制是 Windows NSIS 安装、覆盖升级、卸载和实体手机扫码尚未人工验收，且两个平台安装包均未使用正式开发者签名；这两点应在 Release 中明确披露。
