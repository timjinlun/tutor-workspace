# 依赖注入：接口、实现、调用与组装

## 一句话理解

依赖注入（Dependency Injection，DI）的核心是：

> 一个模块需要什么能力，不自己创建，而是由外部把这个能力交给它。

它把四件事分开：

```text
接口：规定要具备什么能力
实现：决定具体怎么完成
调用方：只按接口使用能力
组装：按运行需求选择并传入具体实现
```

## 四个角色

### 1. 接口：说明书或契约

接口说明外部可以调用哪些动作、需要传入什么、会返回什么。

```ts
interface LearningRecordRepository {
  insert(record: LearningRecord): Promise<void>;
  listByStudent(studentId: string): Promise<LearningRecord[]>;
}
```

它规定了两项能力：

- `insert`：保存一条学习记录；
- `listByStudent`：按学员查询学习记录。

接口不规定内部步骤。它不关心数据最终写入 SQLite、localStorage，还是暂存在内存中。

### 2. 实现：按照说明书完成能力

SQLite 实现：

```ts
class SqliteLearningRecordRepository
  implements LearningRecordRepository {
  async insert(record: LearningRecord) {
    // 写入 SQLite
  }

  async listByStudent(studentId: string) {
    // 从 SQLite 查询
    return [];
  }
}
```

内存实现：

```ts
class MemoryLearningRecordRepository
  implements LearningRecordRepository {
  private records: LearningRecord[] = [];

  async insert(record: LearningRecord) {
    this.records.push(record);
  }

  async listByStudent(studentId: string) {
    return this.records.filter(
      (record) => record.studentId === studentId,
    );
  }
}
```

它们内部做法不同，但都符合 `LearningRecordRepository` 的契约，所以都可以交给调用方使用。

`implements` 是一种显式检查：让 TypeScript 检查这个类是否满足接口。TypeScript 也支持结构化类型，只要对象的形状符合接口，也可以直接传入。

### 3. 调用方：只依赖接口

```ts
function saveRecord(
  repository: LearningRecordRepository,
  record: LearningRecord,
) {
  return repository.insert(record);
}
```

`saveRecord` 不需要知道：

- 数据库文件在哪里；
- 使用的是 SQLite 还是内存；
- 内部有没有事务；
- 记录是怎么序列化的。

它只知道：传入的东西有一个符合约定的 `insert` 方法。

### 4. 组装：选择并传入具体实现

正式 App 使用 SQLite：

```ts
const repository = new SqliteLearningRecordRepository();
saveRecord(repository, record);
```

自动化测试使用内存实现：

```ts
const repository = new MemoryLearningRecordRepository();
saveRecord(repository, record);
```

这里的 `repository` 就是被注入的依赖，`saveRecord` 是使用依赖的调用方。

## “注入”到底发生在哪里？

注入不是一个特殊关键字，而是“从外部传进来”。最常见的形式是函数参数、构造函数参数和 React props。

### 函数参数注入

```ts
function createLearningRecordService(
  repository: LearningRecordRepository,
) {
  return {
    save(record: LearningRecord) {
      return repository.insert(record);
    },
  };
}

const service = createLearningRecordService(
  new SqliteLearningRecordRepository(),
);
```

### 构造函数注入

```ts
class LearningRecordService {
  constructor(
    private repository: LearningRecordRepository,
  ) {}

  save(record: LearningRecord) {
    return this.repository.insert(record);
  }
}
```

### React props 注入

```tsx
function LearningRecordForm({
  onSave,
}: {
  onSave: (content: string) => Promise<void>;
}) {
  return (
    <button onClick={() => onSave("今天能独立列出方程")}>保存</button>
  );
}
```

外层传入保存动作：

```tsx
<LearningRecordForm
  onSave={(content) => store.addLearningRecord(content)}
/>
```

表单不直接操作 Store 或数据库，只使用外部传入的 `onSave`。这也是依赖注入。

## 和依赖倒置的关系

两者相关，但不是同一个概念：

- **依赖倒置**是设计原则：业务模块应该依赖稳定的抽象接口，而不是具体数据库。
- **依赖注入**是实现手段：在运行时把具体实现传给业务模块。

```text
依赖倒置：我应该依赖接口
依赖注入：我在这里把实现传进来
```

不需要 DI 框架。TypeScript 的参数、对象和 React props 已经足够完成大多数依赖注入。

## 放到「记一课」里

以学习记录为例，可以这样分层：

```text
学习记录表单
  需要：保存记录
       ↓ onSave / 操作接口
学习记录操作模块
  负责：校验、生成 ID、更新状态
       ↓ Repository 接口
数据层
  负责：SQLite / localStorage / 内存实现
```

对应关系：

| 角色 | 在「记一课」里的职责 |
| --- | --- |
| 接口 | 规定如何保存、查询学习记录 |
| SQLite 实现 | 正式 App 的本地持久化 |
| localStorage 实现 | 浏览器版的持久化 |
| 内存实现 | 自动化测试使用 |
| Store action | 校验并更新全局状态 |
| UI 组件 | 收集输入、调用传入的动作、显示结果 |
| 组装层 | 把当前环境需要的 Repository 和 action 接起来 |

## 没有依赖注入时

```ts
class LearningRecordService {
  private db = new SqliteDatabase("lesson.db");

  save(record: LearningRecord) {
    this.db.insert(record);
  }
}
```

这个服务自己决定数据库实现，因此和 SQLite 紧密绑定。测试时也必须准备 SQLite。

## 使用依赖注入后

```ts
class LearningRecordService {
  constructor(
    private repository: LearningRecordRepository,
  ) {}

  save(record: LearningRecord) {
    return this.repository.insert(record);
  }
}
```

现在替换数据库时，只修改组装代码，不修改业务服务：

```ts
new LearningRecordService(sqliteRepository);
new LearningRecordService(memoryRepository);
```

## 判断是否做对了

可以问自己三个问题：

1. 调用方是否只依赖接口，而没有直接创建具体实现？
2. 是否可以替换 SQLite、localStorage 或内存实现，而不修改调用方？
3. 具体实现是否只需要遵守接口契约，不需要知道调用方的内部逻辑？

如果答案都是“是”，通常就已经达到了低耦合的目标。

## 最后记忆版

```text
接口 = 说明书：要具备什么能力
实现 = 完成者：具体怎么做到
调用方 = 使用者：只按说明书调用
组装 = 接线员：按需求选择并传入实现
依赖注入 = 把需要的能力从外部传进来
```
