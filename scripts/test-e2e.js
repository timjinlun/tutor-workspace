/**
 * 端到端测试：真的把 App 跑起来，在真界面上操作，再回数据库里查结果。
 *     npx electron scripts/test-e2e.js
 *
 * 用临时的 userData 目录，不会碰到你自己的真实数据。
 */
const { app, BrowserWindow } = require("electron");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tw-e2e-"));
app.setPath("userData", tmp);

/* 把真正的主进程跑起来（它会自己开库、建菜单、开窗口） */
require("../electron/main.js");

const db = require("../electron/db.js");

let failed = 0;
const t = (name, ok, extra) => {
  if (ok) console.log("  ✓ " + name);
  else { failed++; console.error("  ✗ " + name + (extra ? "\n      " + JSON.stringify(extra) : "")); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) { console.error("没有窗口"); app.exit(1); return; }
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once("did-finish-load", r));
  }
  const js = (code) => win.webContents.executeJavaScript(code, true);

  console.log("\n端到端测试（临时数据目录：" + tmp + "）");

  /* ---------- 启动 ---------- */
  const boot = await js(`({app:APP, students:S.students.length, courses:S.courses.length, hasDb:!!window.TWDB})`);
  t("渲染进程识别到自己跑在 App 里（APP===true）", boot.app === true, boot);
  t("首次启动灌入了示例数据", boot.students > 0 && boot.courses > 0, boot);

  /* ---------- 打卡写进数据库 ---------- */
  await js(`(()=>{su({view:"hours",tab:2,calY:2026,calM:6});
    setAttendance("s1","2026-06-03","19:30","c1",1); return 1;})()`);
  await sleep(400);
  let state = db.loadState();
  t("界面打卡 → 落进 SQLite attendance 表",
    !!(state.attendance.s1 && state.attendance.s1["2026-06-03"]),
    state.attendance.s1 && Object.keys(state.attendance.s1).slice(-3));
  t("打卡带上了 markedAt 时间戳",
    !!(state.attendance.s1["2026-06-03"] || {}).markedAt);

  /* ---------- 已打卡的格子点了不会掉数据 ---------- */
  const clicked = await js(`(()=>{
    const c=document.querySelector('[data-action="att"][data-sid="s1"][data-date="2026-06-03"]');
    c.click();
    return {modal:UI.modal&&UI.modal.type, still:!!S.attendance.s1["2026-06-03"],
            title:(document.querySelector('.modal-title')||{}).textContent};})()`);
  t("点已打卡的格子 → 打开复核弹窗，数据不动",
    clicked.modal === "att-review" && clicked.still === true, clicked);

  /* ---------- 二次确认才真取消 ---------- */
  const step2 = await js(`(()=>{document.querySelector('[data-action="att-ask-cancel"]').click();
    return {idx:UI.modal.confirmIdx, still:!!S.attendance.s1["2026-06-03"]};})()`);
  t("第一步确认后数据仍然在（还没删）", step2.still === true, step2);

  await js(`(()=>{document.querySelector('[data-action="att-do-cancel"]').click();return 1;})()`);
  await sleep(400);
  state = db.loadState();
  t("二次确认后才真的从数据库删掉",
    !(state.attendance.s1 && state.attendance.s1["2026-06-03"]));

  /* ---------- 审计流水 ---------- */
  const log = db.attendanceLog(500);
  t("审计表记下了这次打卡", log.some((r) => r.action === "mark" && r.date === "2026-06-03"));
  t("审计表记下了这次取消", log.some((r) => r.action === "cancel" && r.date === "2026-06-03"));

  /* ---------- 待办优先级不再被吞 ---------- */
  await js(`(()=>{ss({...S,todos:[...S.todos,{id:"tdX",title:"E2E测试待办",due:"2026-06-09",priority:"P0",done:false,note:""}]});return 1;})()`);
  await sleep(400);
  state = db.loadState();
  const td = state.todos.find((x) => x.id === "tdX");
  t("待办的 P0 优先级被正确保存（旧版会被吞成 P2）", td && td.priority === "P0", td);

  /* ---------- 重启后数据还在 ---------- */
  await js(`(()=>{ss({...S,students:S.students.map(x=>x.id==="s1"?{...x,name:"张明改名"}:x)});return 1;})()`);
  await sleep(400);
  await js(`location.reload()`);
  await new Promise((r) => win.webContents.once("did-finish-load", r));
  await sleep(300);
  const after = await js(`({name:(S.students.find(x=>x.id==="s1")||{}).name, n:S.students.length})`);
  t("重新载入后读的是数据库里的数据，不是示例数据", after.name === "张明改名", after);

  /* ---------- 数据库面板 ---------- */
  const info = db.stats();
  t("数据库文件真实存在且有内容", info.sizeBytes > 0 && info.students > 0, info);
  t("数据库放在应用数据目录，不是浏览器缓存", info.path.startsWith(tmp), { path: info.path });

  console.log(failed === 0 ? "\n全部通过 ✅\n" : `\n${failed} 项失败 ❌\n`);
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  app.exit(failed === 0 ? 0 : 1);
});
