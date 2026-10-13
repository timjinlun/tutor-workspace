type LogLevel = "info" | "warn" | "error";

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  return String(error);
}

/** 业务层统一使用此入口；Electron 写本地文件，浏览器预览退回控制台。 */
export const logging = {
  info(message: string): void { write("info", message); },
  warn(message: string): void { write("warn", message); },
  error(message: string, error?: unknown): void { write("error", error === undefined ? message : `${message}\n${describe(error)}`); },
};

function write(level: LogLevel, message: string): void {
  if (window.tw) window.tw.logging.write(level, message);
  else console[level](message);
}
