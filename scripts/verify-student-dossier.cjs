/* Production Electron integration, isolated SQLite + synthetic students only. */
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const assert = require('node:assert/strict');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lessonlog-dossier-qa-'));
app.setPath('appData', temp); app.setPath('userData', path.join(temp, 'LessonLog'));
const output = path.resolve('docs/qa/student-dossier'); fs.mkdirSync(output, { recursive: true });
let saved;
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, callback) => handle(channel, async (...args) => { const result = await callback(...args); if(channel === 'data:save' && result.ok) saved = args[1]; return result; });
const pause = ms => new Promise(r => setTimeout(r, ms));
const student = (id, name, courseIds) => ({ id, name, courseIds, note: '内部财务偏好不可对外', createdAt: '2026-01-01', archived: false, sortOrder: id === 's1' ? 0 : 1 });
const state = {
  version: 3, teachers: [], students: [student('s1','张明',['c1']),student('s2','李华',['c2'])],
  courses: [{id:'c1',name:'数学',price:280,unitsPerLesson:1},{id:'c2',name:'英语',price:260,unitsPerLesson:1}],
  classes: [{id:'k',name:'数学小班',courseId:'c1',studentIds:['s1'],active:true,deductOnAbsence:false}],
  templates: [], lessons: Array.from({length:26},(_,i)=>({id:`l${i}`,studentId:'s1',courseId:'c1',date:`2026-${i < 20 ? '09' : '08'}-${String(i % 20 + 1).padStart(2,'0')}`,time:'16:00',price:280,units:1,status:'done',source:'manual',createdAt:''})),
  payments: Array.from({length:4},(_,i)=>({id:`p${i}`,studentId:'s1',date:`2026-0${i+5}-01`,amount:5600,hours:20,note:''})),
  learningRecords: Array.from({length:26},(_,i)=>({id:`r${i}`,studentId:'s1',date:`2026-${i < 20 ? '09' : '08'}-${String(i % 20 + 1).padStart(2,'0')}`,text:i === 0 ? '内部观察绝不对外' : `课堂观察 ${i}：应用题能独立找出数量关系；复杂条件仍需要提示。下一步练习先画图再列式。`,visibility:i === 0 ? 'internal' : 'parent',lessonId:`l${i}`,createdAt:`2026-09-01T00:00:${String(i).padStart(2,'0')}`,updatedAt:''})),
  todos:[], expenses:[], otherIncomes:[], leads:[], materials:[], settings:{ teacherName:'测试老师',appearance:'light',accent:'coral',background:'aurora',unitMinutes:60,lowBalanceThreshold:4,remindAhead:2,onboarded:true,coinValue:{amount:10,month:'2026-09'},jarCapacity:10000 },
};
require(path.resolve('out/main/main.js'));
app.whenReady().then(async () => {
  let win;
  const errors = [];
  try {
    for(let i=0;i<120;i++){ win=BrowserWindow.getAllWindows()[0]; if(win && !win.webContents.isLoading() && win.webContents.getURL())break; await pause(50); }
    assert(win); win.webContents.on('console-message', (_event, level, message) => { if(level === 3) errors.push(message); });
    await pause(300); win.webContents.send('data:imported', state); await pause(400);
    const evaluate = code => win.webContents.executeJavaScript(code);
    const scope = `([...document.querySelectorAll('[role="dialog"]')].at(-1) || document)`;
    const click = async (text) => { await evaluate(`(()=>{const root=${scope};const el=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!el)throw Error('Missing button '+${JSON.stringify(text)});el.click()})()`); await pause(100); };
    const fill = async (selector,value) => { await evaluate(`(()=>{const el=${scope}.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing input');const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`); await pause(80); };
    const screenshot = async name => { await pause(200); fs.writeFileSync(path.join(output,name),(await win.webContents.capturePage()).toPNG()); };
    await evaluate(`document.querySelectorAll('.nav-item')[1].click()`); await pause(200);
    assert.equal(await evaluate(`document.querySelectorAll('[role="tabpanel"] .learning-row').length`),3);
    await click('编辑资料'); await fill('[aria-label="姓名"]','张明（测试）'); await fill('[aria-label="年级"]','初二'); await fill('[aria-label="自定义标签"]','中考，重点跟进'); await fill('[aria-label="学习目标"]','能独立分析多条件应用题'); await click('保存资料'); await pause(300);
    assert.equal(saved.students[0].name,'张明（测试）'); assert.deepEqual(saved.students[0].tags,['中考','重点跟进']);
    await click('筛选');
    await evaluate(`(()=>{for(const text of ['数学','1 对 1','中考']){const label=[...document.querySelectorAll('.directory-filters label')].find(l=>l.textContent.trim()===text);if(!label)throw Error('Missing filter');label.querySelector('input').click();}})()`); await pause(150);
    assert.equal(await evaluate(`document.querySelectorAll('.directory-person').length`),1); await click('清除'); await click('筛选');
    await click('＋ 写记录'); assert.equal(await evaluate(`document.querySelector('.learning-visibility input').checked`),false);
    await fill('[aria-label="记录日期"]','2026-09-14'); await fill('[aria-label="本次观察"]','这次能独立列式，遇到多余条件仍需要提示。'); await fill('[aria-label="关联课程"]','l13');
    await evaluate(`document.querySelector('.learning-visibility input').click()`); await click('保存记录'); await pause(300);
    assert.equal(saved.learningRecords.length,27); assert(saved.learningRecords.some(r=>r.text.startsWith('这次能独立') && r.lessonId === 'l13'));
    await screenshot('learning-light.png');
    await click('查看全部学习记录（27）');
    assert.equal(await evaluate(`document.querySelectorAll('.history-scroll .learning-row').length`),12); await click('下一页');
    await fill('[aria-label="筛选月份"]','2026-08'); assert.equal(await evaluate(`document.querySelectorAll('.history-scroll .learning-row').length`),6);
    await screenshot('learning-history.png'); await click('关闭');
    await click('课时与缴费'); assert.equal(await evaluate(`document.querySelectorAll('[role="tabpanel"] [data-lesson-id]').length`),3);
    await screenshot('ledger-light.png'); await click('查看全部上课记录（26）'); await fill('[aria-label="筛选月份"]','2026-08'); assert.equal(await evaluate(`document.querySelectorAll('.history-scroll [data-lesson-id]').length`),6); await click('关闭');
    await click(await evaluate(`document.querySelector('[data-lesson-id] button').textContent.trim()`));
    assert(await evaluate(`!!document.querySelector('[aria-label="本次观察"]')`)); await click('取消');
    await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedText=text;}}})`);
    await click('续费提醒'); await fill('[aria-label="续费提醒文案"]','测试续费沟通文案'); await click('复制文案');
    assert.equal(await evaluate(`window.__copiedText`),'测试续费沟通文案'); assert(await evaluate(`document.body.textContent.includes('已复制，去微信粘贴发送')`));
    await evaluate(`navigator.clipboard.writeText=async()=>{throw Error('denied')}; void 0`); await click('复制文案'); assert(await evaluate(`document.body.textContent.includes('复制失败，请选中文案手动复制')`)); await click('关闭');
    await click('家长报告'); const report=await evaluate(`document.querySelector('[aria-label="家长报告草稿"]').value`);
    assert(report.includes('这次能独立列式')); assert(!report.includes('内部观察绝不对外')); assert(!report.includes('内部财务偏好'));
    await fill('[aria-label="家长报告草稿"]',report+'\n下一步：先圈出数量关系。');
    await evaluate(`navigator.clipboard.writeText=async text=>{window.__copiedText=text}; void 0`); await click('复制报告'); assert((await evaluate(`window.__copiedText`)).endsWith('先圈出数量关系。')); await screenshot('parent-report.png'); await click('关闭');
    win.setSize(920,650); await pause(250); await evaluate(`document.documentElement.dataset.appearance='dark'`); await screenshot('compact-dark.png');
    assert(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`));
    win.setSize(1240,820); await evaluate(`document.documentElement.dataset.appearance='light'`);
    await pause(350); win.webContents.reload(); await pause(600); await evaluate(`document.querySelectorAll('.nav-item')[1].click()`); await pause(250);
    assert(await evaluate(`document.body.textContent.includes('张明（测试）')`));
    const loaded=await evaluate(`window.tw.data.load()`); assert.equal(loaded.learningRecords.length,27); assert.equal(loaded.students[0].grade,'初二');
    await screenshot('after-reload.png');
    // Existing src/index.html contains a theme bootstrap blocked by its own CSP.
    // Keep this known unrelated diagnostic visible, and fail for all other errors.
    const baselineWarnings=errors.filter(message=>message.startsWith('Executing inline script violates the following Content Security Policy'));
    const unexpected=errors.filter(message=>!baselineWarnings.includes(message));
    const evidence={isolatedData:temp,productionDataTouched:false,records:loaded.learningRecords.length,summaryLimit:3,historyPageSize:12,monthFilter:true,editedProfilePersisted:true,tagsAndFilter:true,renewalSuccessAndFailure:true,reportPrivacy:true,reload:true,compactNoHorizontalOverflow:true,rendererErrors:unexpected,baselineWarnings};
    fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2)); console.log(JSON.stringify(evidence));
    assert.deepEqual(unexpected,[]); app.exit(0);
  } catch(error) { console.error(error); if(win)fs.writeFileSync(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG()); app.exit(1); }
});
