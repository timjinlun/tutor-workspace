/* Exercise the production main/preload/renderer and SQLite, never the user's data. */
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { buildSync } = require('esbuild');
const root = process.argv[2];
const phase = process.argv[3];
assert(root && ['write', 'read'].includes(phase), 'Use npm run test:desktop');
app.setPath('appData', root);
app.setPath('userData', path.join(root, 'LessonLog'));
const output = path.resolve(`out/qa/desktop-${process.platform}`);
fs.mkdirSync(output, { recursive: true });
// Remove only this phase's generated result so a failure cannot leave a stale PASS.
fs.rmSync(path.join(output, `${phase}.json`), { force: true });
const files = { db: path.join(root, '课时备份.db'), json: path.join(root, '教学记录.json'), png: path.join(root, '分享海报.png') };
// Substitute only the native file picker; production handlers still write/read the files.
dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: files[options.filters[0].extensions[0]] });
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [files.json] });
dialog.showErrorBox = (title, message) => { console.error(title, message); app.exit(1); };
let saved;
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, callback) => handle(channel, async (...args) => {
  const result = await callback(...args);
  if (channel === 'data:save' && result.ok) saved = args[1];
  return result;
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 200; i++) { if (await check()) return; await pause(50); }
  throw new Error(message);
}
const failures = [];
app.on('web-contents-created', (_event, contents) => {
  // CI and an unfocused local window must still finish animation frames and timers.
  contents.setBackgroundThrottling(false);
  contents.on('render-process-gone', (_e, details) => failures.push(`renderer exited: ${details.reason}`));
  contents.on('did-fail-load', (_e, code, description) => failures.push(`load failed: ${code} ${description}`));
});
require(path.resolve('out/main/main.js'));
const watchdog = setTimeout(() => { console.error('Desktop smoke timeout'); app.exit(1); }, 75000);
app.whenReady().then(async () => {
  let win;
  try {
    await until(() => {
      win = BrowserWindow.getAllWindows()[0];
      return win && !win.webContents.isLoading() && win.webContents.getURL();
    }, 'No application window');
    const evaluate = async code => {
      try { return await win.webContents.executeJavaScript(`(async () => (${code}))()`); }
      catch (error) { throw new Error(`Renderer check failed: ${code}`, { cause: error }); }
    };
    await until(() => evaluate(`!!window.tw && document.querySelectorAll('.nav-item').length === 6 && !!document.querySelector('.sidebar-foot')`), 'Renderer did not hydrate');
    assert.equal(await evaluate('window.tw.system.platform'), process.platform);
    assert.equal(await evaluate('document.documentElement.dataset.platform'), process.platform);
    const info = await evaluate('window.tw.data.info()');
    assert.equal(info.path, path.join(root, 'LessonLog', 'data', 'data.db'));
    const padding = await evaluate(`getComputedStyle(document.querySelector('.sidebar')).paddingTop`);
    assert.equal(padding, process.platform === 'darwin' ? '52px' : '20px');
    const click = async text => {
      await until(() => evaluate(`(() => {
        const root = [...document.querySelectorAll('[role="dialog"]')].at(-1) || document;
        const button = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute('aria-label') === ${JSON.stringify(text)} || b.querySelector('.more-name')?.textContent === ${JSON.stringify(text)} || (b.classList.contains('nav-item') && [...b.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() === ${JSON.stringify(text)})));
        if (!button || button.disabled) return false;
        button.click();
        return true;
      })()`), `Missing enabled button: ${text}`);
      await pause(100);
    };
    const fill = async (label, value) => {
      await evaluate(`(() => {
        const input = document.querySelector('[aria-label=' + ${JSON.stringify(JSON.stringify(label))} + ']');
        if (!input) throw new Error('Missing input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await pause(100);
    };
    const shot = async name => {
      await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      fs.writeFileSync(path.join(output, name), (await win.webContents.capturePage()).toPNG());
    };
    if (phase === 'write') {
      const built = buildSync({ entryPoints: ['src/core/types.ts'], bundle: true, write: false, format: 'cjs', platform: 'node' }).outputFiles[0].text;
      const fixture = { exports: {} };
      new Function('module', 'exports', 'require', built)(fixture, fixture.exports, require);
      const state = fixture.exports.emptyState();
      state.settings = { ...state.settings, teacherName: 'Windows 验证老师', appearance: 'light', background: 'none', onboarded: true };
      state.courses = [{ id: 'smoke-course', name: '数学', price: 200, unitsPerLesson: 1 }];
      state.students = [{ id: 'smoke-student', name: '测试学员', courseIds: ['smoke-course'], note: '', createdAt: '2026-09-15', archived: false, sortOrder: 0 }];
      win.webContents.send('data:imported', state);
      await until(() => saved?.students[0]?.id === 'smoke-student', 'Fixture not saved');
      // Reload so form defaults come from the fixture rather than the first-launch demo.
      await new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.reload(); });
      await until(() => evaluate(`!!document.querySelector('.sidebar-foot') && document.body.textContent.includes('Windows 验证老师')`), 'Fixture did not hydrate');
      await click('记一节课'); await click('记为已上');
      await until(() => saved?.lessons.some(l => l.status === 'done'), 'Lesson did not persist');
      const lessonId = saved.lessons.find(l => l.status === 'done').id;
      assert.equal(saved.lessons.find(l => l.id === lessonId).studentId, 'smoke-student');
      assert.equal(saved.lessons.find(l => l.id === lessonId).price, 200);
      await shot('today-light.png');
      if (process.platform === 'darwin') {
        await evaluate(`document.documentElement.dataset.platform = 'win32'`);
        assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sidebar')).paddingTop`), '20px');
        await shot('windows-layout-preview-on-mac.png');
        await evaluate(`document.documentElement.dataset.platform = 'darwin'`);
      }
      await evaluate(`document.querySelector('[title="撤销打卡（需确认）"]').click()`); await pause(200);
      await click('撤销打卡');
      await until(() => !saved.lessons.some(l => l.id === lessonId && l.status === 'done'), 'Undo did not persist');
      await click('学员'); await click('课时与缴费'); await click('＋ 缴费');
      await fill('缴费课时', '10'); await fill('缴费金额', '2000'); await click('记入');
      await until(() => saved.payments.some(p => p.hours === 10 && p.amount === 2000), 'Payment did not persist');
      await shot('student-ledger.png');
      assert((await evaluate('window.tw.data.backup()')).ok);
      const backup = new DatabaseSync(files.db, { readOnly: true });
      try { assert.equal(backup.prepare('PRAGMA quick_check').get().quick_check, 'ok'); } finally { backup.close(); }
      assert((await evaluate('window.tw.data.exportJSON(await window.tw.data.load())')).ok);
      const exported = JSON.parse(fs.readFileSync(files.json, 'utf8'));
      assert.equal(exported.data.payments[0].amount, 2000);
      // Change the exported copy so the subsequent read proves import actually replaced state.
      exported.data.students[0].note = 'JSON 导入验证';
      fs.writeFileSync(files.json, JSON.stringify(exported));
      await evaluate('window.tw.data.importJSON()');
      await until(() => saved.students[0]?.note === 'JSON 导入验证', 'JSON import did not persist');
      await click('更多'); await click('成绩卡');
      await until(() => evaluate(`document.querySelector('[role="dialog"] canvas')?.width === 1080`), 'Scorecard not rendered');
      await click('保存图片');
      await until(() => fs.existsSync(files.png), 'PNG was not saved');
      const png = fs.readFileSync(files.png);
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1350);
      fs.copyFileSync(files.png, path.join(output, 'scorecard.png'));
      await click('关闭');
      await click('今天');
      await evaluate(`window.tw.system.setAppearance('dark')`);
      await evaluate(`document.documentElement.dataset.appearance = 'dark'`);
      await pause(200); await shot('today-dark.png');
      const audit = await evaluate('window.tw.data.recentAudit(100)');
      assert(audit.length >= 3);
      fs.writeFileSync(path.join(root, 'expected.json'), JSON.stringify({ student: saved.students[0], payments: saved.payments, lessons: saved.lessons }));
    } else {
      const expected = JSON.parse(fs.readFileSync(path.join(root, 'expected.json'), 'utf8'));
      const loaded = await evaluate('window.tw.data.load()');
      assert.deepEqual(loaded.students[0], expected.student);
      assert.deepEqual(loaded.payments, expected.payments);
      assert.deepEqual(loaded.lessons, expected.lessons);
      await shot('after-restart.png');
    }
    assert.deepEqual(failures, []);
    fs.writeFileSync(path.join(output, `${phase}.json`), JSON.stringify({ platform: process.platform, electron: process.versions.electron, phase, result: 'PASS', checks: phase === 'write' ? ['isolated-chinese-path', 'native-platform', 'lesson', 'undo', 'payment', 'sqlite-backup', 'json-export-import', 'png-export', 'audit'] : ['persistence-after-process-restart'] }, null, 2));
    clearTimeout(watchdog);
    app.quit();
  } catch (error) {
    console.error(error);
    if (win && !win.isDestroyed()) console.error(await win.webContents.executeJavaScript(`JSON.stringify({ dialogs: [...document.querySelectorAll('[role="dialog"]')].map(x => x.outerHTML.slice(0, 300)), buttons: [...document.querySelectorAll('button')].map(x => ({text:x.textContent.trim(), cls:x.className, nodes:[...x.childNodes].map(n=>[n.nodeType,n.textContent])})).slice(0,12) })`));
    if (win && !win.isDestroyed()) fs.writeFileSync(path.join(output, 'failure.png'), (await win.webContents.capturePage()).toPNG());
    clearTimeout(watchdog);
    app.exit(1);
  }
});
