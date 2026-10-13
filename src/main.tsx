import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { useStore } from "@/store";
import { selectRepository } from "@/data";
import { platform } from "@/platform";
import "@/ui/styles/base.css";

// Apply native chrome spacing before the first frame, including the loading shell.
if (window.tw) document.body.classList.add("app");
document.documentElement.dataset.platform = window.tw?.system.platform ?? "browser";

const repo = selectRepository();
void useStore.getState().hydrate(repo);

window.addEventListener("error", (event) => platform.logging.error("Unhandled renderer error", event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => platform.logging.error("Unhandled renderer promise rejection", event.reason));

/* 菜单里「从 JSON 导入」选完文件后，主进程把数据推过来，先出确认 */
window.tw?.data.onImported((state) => useStore.getState().requestImport(state));

createRoot(document.getElementById("root")!).render(<App />);
