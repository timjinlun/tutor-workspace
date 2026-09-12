# ADR-0002 · 分层与模块边界

日期：2026-09-12 · 状态：已采纳

## 分层（依赖只能向内）

```
ui/features/*  ──►  store  ──►  core
      │                │
      ▼                ▼
ui/primitives     data · entitlements · platform
```

| 层 | 职责 | 不许做的事 |
|---|---|---|
| `core` | 领域模型、业务规则、纯函数（课的状态机、余额、统计） | 碰 DOM、IO、时间以外的任何外部状态 |
| `entitlements` | 免费 / 商业版的功能开关与限额，唯一的"能不能"出口 | 含业务逻辑 |
| `data` | `Repository` 接口 + 各持久化实现 | 含业务逻辑 |
| `platform` | 系统强调色、剪贴板、文件对话框等平台能力，接口化 | 含业务逻辑 |
| `store` | 状态 + Command；每个改数据的操作都是一个具名 action | 直接操作 DOM |
| `ui/primitives` | 设计系统组件，无业务 | import store / core |
| `ui/features/<name>` | 一个功能一个目录，自包含 | import 其他 feature |

边界由 `eslint-plugin-boundaries` 强制，违规即 lint 错误。

## 用到的模式

- **Repository**：持久化可替换（SQLite / localStorage / 内存）。
- **Strategy**：浏览器版与 App 版在启动时选不同 Repository。
- **Command**：改动数据的操作集中在 store 的 action 里，审计流水由 action 生成，UI 拿不到直接改状态的手柄。
- **State machine**：一节课 `scheduled → done → (undo) scheduled`，`scheduled → cancelled`。

## 加一个功能的步骤

1. `src/ui/features/<name>/` 建目录，写页面。
2. 需要新数据就在 `core/types.ts` 加类型、`store` 加 action。
3. 在 `entitlements` 登记它属于哪个等级。
4. 在 `app/routes.ts` 注册路由。

不需要改任何别的 feature。
