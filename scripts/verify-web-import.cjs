/* 网页版导入 → 确认 → 划课表顺序与十字高亮 → 只记金额缴费。先 npm run build；数据全在临时目录，不碰正式库。 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lessonlog-web-import-qa-'));
app.setPath('appData', temp); app.setPath('userData', path.join(temp, 'LessonLog'));
const output = path.resolve('docs/qa/web-import'); fs.mkdirSync(output, { recursive: true });
/* 用网页版 v8 自己的 exportData 生成的文件；expected 是网页版自己算的每人课时 */
const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/web-real-v8.json'), 'utf8'));
const importFile = path.join(temp, 'web-export.json');
fs.writeFileSync(importFile, JSON.stringify(fixture.payload));
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [importFile] });
let saved;
const originalHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, callback) => originalHandle(channel, async (...args) => { const result = await callback(...args); if (channel === 'data:save' && result.ok) saved = args[1]; return result; });
const pause = ms => new Promise(r => setTimeout(r, ms));
require(path.resolve('out/main/main.js'));
const watchdog = setTimeout(() => { console.error('Web import QA timeout'); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  let win;
  try {
    for (let i = 0; i < 120; i++) { win = BrowserWindow.getAllWindows()[0]; if (win && !win.webContents.isLoading() && win.webContents.getURL()) break; await pause(50); }
    /* 窗口被挡住时 Chromium 不出帧，悬停和截图都会停在旧画面 */
    assert(win); win.webContents.setBackgroundThrottling(false); win.focus(); win.setSize(1240, 820); await pause(300);
    const evaluate = code => win.webContents.executeJavaScript(code);
    const until = async (fn, message) => { for (let i = 0; i < 60; i++) { if (await fn()) return; await pause(80); } throw new Error(message); };
    const click = async text => { await evaluate(`(() => { const root = [...document.querySelectorAll('[role="dialog"]')].at(-1) || document; const el = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!el) throw Error('Missing button: ' + ${JSON.stringify(text)}); if (el.disabled) throw Error('Disabled: ' + ${JSON.stringify(text)}); el.click(); })()`); await pause(180); };
    const nav = async label => { await evaluate(`[...document.querySelectorAll('.nav-item')].find(b => [...b.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() === ${JSON.stringify(label)})).click()`); await pause(200); };
    const fill = async (label, value) => { await evaluate(`(() => { const el = document.querySelector('[aria-label="${label}"]'); if (!el) throw Error('Missing input ${label}'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`); await pause(80); };
    const rect = async selector => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const shot = async name => { await pause(200); fs.writeFileSync(path.join(output, name), (await win.webContents.capturePage()).toPNG()); };
    const imports = async () => (await evaluate('window.tw.data.recentAudit(50)')).filter(a => a.kind === 'data.import').length;

    /* 1. 菜单导入：先出确认，说清楚有多少课；确认前不动数据 */
    const before = saved?.students.map(s => s.name);
    win.webContents.send('data:imported', fixture.payload.data);
    await until(() => evaluate(`!!document.querySelector('[role="dialog"]')`), 'Confirmation not shown');
    const sheet = await evaluate(`document.querySelector('[role="dialog"]').textContent`);
    assert(sheet.includes('6 名学员') && sheet.includes('71 节上过的课') && sheet.includes('不会叠加'), sheet);
    assert.deepEqual(saved?.students.map(s => s.name), before);
    await shot('01-import-confirm.png');
    await click('覆盖导入');
    await until(() => saved?.lessons.filter(l => l.status === 'done').length === 71, 'Import did not persist');
    for (const [id, want] of Object.entries(fixture.expected)) {
      const used = saved.lessons.filter(l => l.studentId === id && l.status === 'done').reduce((a, l) => a + l.units, 0);
      const bought = saved.payments.filter(p => p.studentId === id).reduce((a, p) => a + p.hours, 0);
      assert.deepEqual({ id, used, bought }, { id, used: want.used, bought: want.bought });
    }
    assert.equal(await imports(), 1);

    /* 2. 学员名单里把最后一位拖到最上面，划课表跟着变 */
    await nav('学员');
    const grips = await evaluate(`[...document.querySelectorAll('.directory-grip')].map(g => { const r = g.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })`);
    const from = grips.at(-1), to = grips[0];
    win.webContents.sendInputEvent({ type: 'mouseMove', x: from.x, y: from.y });
    win.webContents.sendInputEvent({ type: 'mouseDown', x: from.x, y: from.y, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 12; i++) { win.webContents.sendInputEvent({ type: 'mouseMove', x: from.x, y: Math.round(from.y + (to.y - 8 - from.y) * i / 12), button: 'left' }); await pause(30); }
    win.webContents.sendInputEvent({ type: 'mouseUp', x: from.x, y: to.y - 8, button: 'left', clickCount: 1 });
    await pause(400);
    const directory = await evaluate(`[...document.querySelectorAll('.directory-person .directory-name b')].map(b => b.textContent)`);
    assert.equal(directory[0], '赵雷', `drag did not reorder: ${directory}`);
    await nav('课表'); await click('按学员');
    for (let i = 0; i < 8; i++) await click('上一页');
    const grid = await evaluate(`[...document.querySelectorAll('table.month td.nm span')].map(s => s.textContent)`);
    assert.deepEqual(grid, directory);

    /* 3. 十字高亮：鼠标停在某格，整行整列都亮，表头日期变色 */
    const cell = await rect('table.month tbody tr:nth-child(2) td[data-date="2026-01-14"]');
    win.webContents.sendInputEvent({ type: 'mouseMove', x: cell.x, y: cell.y });
    await pause(250);
    const hl = await evaluate(`(() => {
      const on = [...document.querySelectorAll('.col-on')];
      const head = document.querySelector('table.month thead th.col-on .num');
      const rowName = document.querySelector('table.month tbody tr:nth-child(2) td.nm');
      const otherName = document.querySelector('table.month tbody tr:nth-child(3) td.nm');
      return { cols: on.length, head: head?.textContent, row: getComputedStyle(rowName).boxShadow, other: getComputedStyle(otherName).boxShadow, weekend: getComputedStyle(document.querySelector('table.month tbody tr:nth-child(3) td[data-date="2026-01-17"]')).boxShadow };
    })()`);
    assert.equal(hl.cols, grid.length + 1, JSON.stringify(hl));
    assert.equal(hl.head, '14');
    assert.notEqual(hl.row, 'none', JSON.stringify(hl)); assert.equal(hl.other, 'none'); assert.equal(hl.weekend, 'none');
    await shot('02-grid-crosshair.png');

    /* 4. 只填金额、不填课时也能记入（包月），列表显示「只记金额」 */
    await nav('学员');
    await evaluate(`[...document.querySelectorAll('.directory-person')].find(b => b.textContent.includes('王芳')).click()`); await pause(200);
    await click('课时与缴费'); await click('＋ 缴费');
    await fill('缴费金额', '800');
    assert(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('只记一笔收款')`));
    await shot('03-money-only-payment.png');
    await click('记入');
    await until(() => saved.payments.some(p => p.hours === 0 && p.amount === 800), 'Money-only payment not saved');
    await evaluate(`[...document.querySelectorAll('.ledger-row')].find(r => r.textContent.includes('只记金额')).scrollIntoView({ block: 'center' })`);
    await shot('04-ledger.png');

    /* 5. 设置页导入只生效一次（以前主进程和页面各替换一遍） */
    await evaluate(`document.querySelector('.sidebar-foot').click()`); await pause(200);
    await click('从 JSON 导入…');
    await until(() => evaluate(`!!document.querySelector('[role="dialog"]')?.textContent.includes('不会叠加')`), 'Settings import not confirmed');
    await click('覆盖导入'); await pause(500);
    assert.equal(await imports(), 2);

    const evidence = { productionDataTouched: false, isolatedData: temp, fixture: 'tests/fixtures/web-real-v8.json', confirmBeforeOverwrite: true, lessonsImported: 71, perStudentMatchesWeb: true, gridFollowsManualOrder: true, crosshair: true, moneyOnlyPayment: true, singleImportAudit: true };
    fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence)); clearTimeout(watchdog); app.exit(0);
  } catch (error) { console.error(error); if (win) fs.writeFileSync(path.join(temp, 'failure.png'), (await win.webContents.capturePage()).toPNG()); console.error('Failure artifacts:', temp); clearTimeout(watchdog); app.exit(1); }
});
