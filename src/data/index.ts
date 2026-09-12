/** Strategy：启动时按运行环境挑一个 Repository */
import type { Repository } from "./repository";
import { electronRepository } from "./electron";
import { localStorageRepository } from "./localStorage";

export type { Repository } from "./repository";
export { memoryRepository } from "./memory";

export function selectRepository(): Repository {
  if (typeof window !== "undefined" && window.tw) return electronRepository();
  return localStorageRepository();
}
