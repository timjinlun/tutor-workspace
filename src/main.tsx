import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { useStore } from "@/store";
import { selectRepository } from "@/data";
import "@/ui/styles/base.css";

// Apply native chrome spacing before the first frame, including the loading shell.
if (window.tw) document.body.classList.add("app");
document.documentElement.dataset.platform = window.tw?.system.platform ?? "browser";

const repo = selectRepository();
void useStore.getState().hydrate(repo);

/* 菜单里「从 JSON 导入」完成后，主进程把新数据推过来 */
window.tw?.data.onImported((state) => useStore.getState().replaceState(state, "data.import"));

createRoot(document.getElementById("root")!).render(<App />);
