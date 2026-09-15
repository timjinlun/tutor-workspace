/* Production UI regression with isolated synthetic data. Run after npm run build. */
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lessonlog-teaching-qa-'));
app.setPath('appData', temp); app.setPath('userData', path.join(temp, 'LessonLog'));
const output = path.resolve('docs/qa/teaching-layout'); fs.mkdirSync(output, { recursive: true });
const demo = buildSync({ entryPoints: ['src/core/demo.ts'], bundle: true, write: false, format: 'cjs', platform: 'node' }).outputFiles[0].text;
const moduleRef = { exports: {} }; new Function('module', 'exports', 'require', demo)(moduleRef, moduleRef.exports, require);
const state = moduleRef.exports.demoState('2026-09-14');
state.settings.appearance = 'light'; state.settings.accent = 'coral';
let saved;
const originalHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, callback) => originalHandle(channel, async (...args) => { const result = await callback(...args); if (channel === 'data:save' && result.ok) saved = args[1]; return result; });
const pause = ms => new Promise(r => setTimeout(r, ms));
require(path.resolve('out/main/main.js'));
const watchdog = setTimeout(() => { console.error('Teaching QA timeout'); app.exit(1); }, 45000);
app.whenReady().then(async () => {
  let win;
  try {
    for (let i = 0; i < 120; i++) { win = BrowserWindow.getAllWindows()[0]; if (win && !win.webContents.isLoading() && win.webContents.getURL()) break; await pause(50); }
    assert(win); await pause(250); win.webContents.send('data:imported', state); await pause(400);
    const evaluate = code => win.webContents.executeJavaScript(code);
    const click = async text => { await evaluate(`(() => { const root = [...document.querySelectorAll('[role="dialog"]')].at(-1) || document; const el = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!el) throw Error('Missing button: ' + ${JSON.stringify(text)}); el.click(); })()`); await pause(180); };
    const tab = async id => { await evaluate(`document.getElementById('teaching-tab-${id}').click()`); await pause(100); };
    const fill = async (label, value) => { await evaluate(`(() => { const el = document.querySelector('[aria-label="${label}"]'); if (!el) throw Error('Missing input ${label}'); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`); await pause(50); };
    const shot = async name => { await pause(150); fs.writeFileSync(path.join(output, name), (await win.webContents.capturePage()).toPNG()); };
    await click('教学管理');
    assert.equal(await evaluate(`document.querySelectorAll('[role="tab"]').length`), 3);
    assert.equal(await evaluate(`document.querySelectorAll('[role="tabpanel"] input').length`), 0);
    assert(await evaluate(`document.querySelector('[data-course-id="c3"]').textContent.includes('¥300') && document.querySelector('[data-course-id="c3"]').textContent.includes('90 分钟')`));
    await shot('01-courses.png');
    await click('新课程'); await click('保存课程'); assert(await evaluate(`document.body.textContent.includes('请填写课程名称')`));
    await fill('课程名称', '不会保存的草稿'); await click('取消'); assert.equal(saved.courses.length, 3);
    await click('编辑课程 数学'); await fill('课程单价', '300'); await shot('02-course-editor.png'); await click('保存课程'); await pause(250);
    assert.equal(saved.courses.find(c => c.id === 'c1').price, 300); assert.deepEqual(saved.lessons.map(l => l.price), state.lessons.map(l => l.price));
    await click('课时规则'); await fill('默认课时分钟', '50'); await click('保存规则'); await pause(250); assert.equal(saved.settings.unitMinutes, 50);
    await tab('classes'); assert.equal(await evaluate(`document.querySelectorAll('[data-course-id]').length`), 0); await shot('03-classes.png');
    await click('管理班级 初二数学小班'); await fill('班级单价', '200'); await fill('班级老师', 't2'); await fill('缺席规则', 'keep');
    await click('李华'); await shot('04-class-editor.png'); await click('保存班级'); await pause(250);
    assert(saved.classes[0].studentIds.includes('s2')); assert.equal(saved.classes[0].teacherId, 't2'); assert.equal(saved.classes[0].deductOnAbsence, false);
    await click('暂停开课'); await pause(250); assert.equal(saved.classes[0].active, false); await click('恢复开课'); await pause(250); assert.equal(saved.classes[0].active, true);
    await tab('teachers'); await shot('05-teachers.png');
    await click('编辑老师 李老师'); await fill('老师课时费', '110'); await click('绿色'); await click('保存老师'); await pause(250); assert.equal(saved.teachers.find(t => t.id === 't2').payPerUnit, 110);
    await click('编辑老师 王老师'); await fill('老师姓名', '王老师（测试）'); await click('保存老师'); await pause(250); assert.equal(saved.settings.teacherName, '王老师（测试）'); assert.equal(saved.teachers.find(t => t.self).name, '王老师（测试）');
    await click('添加老师'); await fill('老师姓名', '合作老师'); await fill('老师课时费', '-1'); await click('保存老师'); assert(await evaluate(`document.body.textContent.includes('课时费不能为负数')`)); await fill('老师课时费', '0'); await click('保存老师'); await pause(250); assert.equal(saved.teachers.length, 3);
    await evaluate(`document.getElementById('teaching-tab-teachers').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}))`); await pause(100);
    assert.equal(await evaluate(`document.querySelector('[role="tab"][aria-selected="true"]').id`), 'teaching-tab-courses');
    win.setSize(920,650); await pause(150); await evaluate(`document.documentElement.dataset.appearance='dark'`);
    for (const id of ['courses','classes','teachers']) { await tab(id); assert(await evaluate(`document.querySelector('.main').scrollWidth <= document.querySelector('.main').clientWidth`)); await shot(`06-compact-${id}.png`); }
    win.setSize(1240,820); await evaluate(`document.documentElement.dataset.appearance='light'`);
    await tab('courses'); await click('编辑课程 数学'); await click('删除这门课程…'); await click('确认删除'); assert(await evaluate(`document.body.textContent.includes('还有班级使用这门课')`));
    await pause(300); win.webContents.reload(); await pause(700); await click('教学管理'); const loaded = await evaluate(`window.tw.data.load()`); assert.equal(loaded.courses[0].price, 300); assert.equal(loaded.classes[0].pricePerUnit, 200); assert.equal(loaded.teachers.find(t=>t.id==='t2').payPerUnit,110);
    const evidence = { productionDataTouched: false, isolatedData: temp, tabs: 3, summaryOnly: true, courseEdit: true, draftCancel: true, historyPricesPreserved: true, rules: true, classMembersAndRules: true, pauseResume: true, teacherEditAndSelfSync: true, keyboardTabs: true, compactDark: true, deletionGuard: true, reload: true };
    fs.writeFileSync(path.join(output,'evidence.json'), JSON.stringify(evidence,null,2)); console.log(JSON.stringify(evidence)); clearTimeout(watchdog); app.exit(0);
  } catch (error) { console.error(error); if(win) fs.writeFileSync(path.join(temp,'failure.png'), (await win.webContents.capturePage()).toPNG()); console.error('Failure artifacts:',temp); clearTimeout(watchdog); app.exit(1); }
});
