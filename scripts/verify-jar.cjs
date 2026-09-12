/* Isolated Electron visual check. Never opens the user's database. */
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lessonlog-jar-qa-'));
app.setPath('userData', tmp);
const output = path.resolve('docs/qa/jar');
fs.mkdirSync(output, { recursive: true });
const preload = path.join(tmp, 'preload.cjs');
fs.writeFileSync(preload, `const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('tw', {
 data: { load:()=>ipcRenderer.invoke('load'), save:async()=>({ok:true}), audit:async()=>{}, onImported:(fn)=>{const h=(_e,s)=>fn(s); ipcRenderer.on('state',h);return ()=>ipcRenderer.removeListener('state',h);}, info:async()=>({sizeBytes:0,snapshots:0,path:'isolated QA'}), savePng:async()=>({ok:true}) },
 wallpaper:{get:async()=>null}, system:{platform:'darwin',setAppearance:async()=>{},accentColor:async()=>null,onAccentChange:()=>()=>{}}
});`);
const date = new Date();
const today = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const fixture = (amount, appearance = 'light') => ({ version:3, teachers:[], students:[{id:'s',name:'示例学员',courseIds:['c'],note:'',createdAt:today,archived:false,sortOrder:0}], courses:[{id:'c',name:'数学',price:280,unitsPerLesson:1}], classes:[], payments:[], templates:[], lessons:[...(amount ? [{id:'done',studentId:'s',courseId:'c',date:today,time:'09:00',status:'done',units:1,price:amount,source:'manual',createdAt:''}] : []),{id:'pending',studentId:'s',courseId:'c',date:today,time:'16:00',status:'scheduled',units:1,price:280,source:'manual',createdAt:''}], todos:[],expenses:[],otherIncomes:[],leads:[],materials:[],settings:{teacherName:'老师',appearance,accent:'coral',background:'none',unitMinutes:60,lowBalanceThreshold:4,remindAhead:2,onboarded:true,coinValue:{amount:10,month:today.slice(0,7)},jarCapacity:10000} });
ipcMain.handle('load',()=>fixture(0));
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1240,height:820,show:true,webPreferences:{preload,contextIsolation:true,sandbox:true}});
 const errors=[];
 win.webContents.on('console-message',(_e,level,message)=>{if(level===3)errors.push(message);});
 try {
  await win.loadFile(path.resolve('out/renderer/index.html')); await pause(500);
  for(const [name,amount,appearance] of [['empty',0,'light'],['half',5000,'light'],['near-full',9500,'light'],['dark',5000,'dark']]) {
   win.webContents.send('state',fixture(amount,appearance)); await pause(350);
   fs.writeFileSync(path.join(output,`${name}.png`),(await win.webContents.capturePage()).toPNG());
  }
  await win.webContents.executeJavaScript(`window.__rafCount=0; const original=window.requestAnimationFrame;window.requestAnimationFrame=(fn)=>{window.__rafCount++;return original(fn)};Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了').click()`);
  await pause(150);
  const flightCount = await win.webContents.executeJavaScript(`document.querySelectorAll('.income-flight').length`);
  fs.writeFileSync(path.join(output,'feedback-flight.png'),(await win.webContents.capturePage()).toPNG());
  await pause(1550);
  const finalIncome = await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.stat')).find(e=>e.textContent.includes('本月确认收入')).textContent`);
  const start = await win.webContents.executeJavaScript(`({count:window.__rafCount,animating:document.querySelector('.savings-jar canvas').dataset.animating})`);
  await pause(1000);
  const end=await win.webContents.executeJavaScript(`window.__rafCount`);
  const knownBaselineErrors=errors.filter(e=>e.includes('Executing inline script violates'));
  const unexpectedErrors=errors.filter(e=>!knownBaselineErrors.includes(e));
  const result={flightCount,finalIncome,start,oneSecondLater:end,idleRafDelta:end-start.count,knownBaselineErrors,unexpectedErrors};
  fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  if(flightCount!==1||!finalIncome.includes('5,280')||start.animating!=='false'||end!==start.count||unexpectedErrors.length)process.exitCode=1;
 }catch(e){console.error(e);process.exitCode=1;}finally{win.destroy();app.exit(process.exitCode||0);}
});
