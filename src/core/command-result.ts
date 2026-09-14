/** 操作层通用结果；不依赖任何业务模块。 */
export type CommandResult = { ok: true } | { ok: false; reason: string };
