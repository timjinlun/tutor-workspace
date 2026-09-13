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
 data: { load:()=>ipcRenderer.invoke('load'), save:(s)=>ipcRenderer.invoke('save',s), audit:async()=>{}, onImported:(fn)=>{const h=(_e,s)=>fn(s); ipcRenderer.on('state',h);return ()=>ipcRenderer.removeListener('state',h);}, info:async()=>({sizeBytes:0,snapshots:0,path:'isolated QA'}), savePng:async()=>({ok:true}) },
 wallpaper:{get:async()=>null}, system:{platform:'darwin',setAppearance:async()=>{},accentColor:async()=>null,onAccentChange:()=>()=>{}}
});`);
const date = new Date();
const today = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const fixture = (amount, appearance = 'light') => ({ version:3, teachers:[], students:[{id:'s',name:'示例学员',courseIds:['c'],note:'',createdAt:today,archived:false,sortOrder:0}], courses:[{id:'c',name:'数学',price:280,unitsPerLesson:1}], classes:[], payments:[], templates:[], lessons:[...(amount ? [{id:'done',studentId:'s',courseId:'c',date:today,time:'09:00',status:'done',units:1,price:amount,source:'manual',createdAt:''}] : []),{id:'pending',studentId:'s',courseId:'c',date:today,time:'16:00',status:'scheduled',units:1,price:280,source:'manual',createdAt:''}], todos:[],expenses:[],otherIncomes:[],leads:[],materials:[],settings:{teacherName:'老师',appearance,accent:'coral',background:'none',unitMinutes:60,lowBalanceThreshold:4,remindAhead:2,onboarded:true,coinValue:{amount:10,month:today.slice(0,7)},jarCapacity:10000} });
let savedState=fixture(0);
ipcMain.handle('load',()=>savedState);
ipcMain.handle('save',(_event,state)=>{savedState=state;return {ok:true};});
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const waitForJarIdle = async (win, timeout = 10000) => {
 const deadline = Date.now() + timeout;
 while (Date.now() < deadline) {
  const idle = await win.webContents.executeJavaScript(`document.querySelector('.coin-pile canvas')?.dataset.animating==='false'`);
  if (idle) return;
  await pause(100);
 }
 throw new Error('金币物理在限定时间内未结算');
};
const waitForDynamicCoin = async (win, timeout = 5000) => {
 const deadline = Date.now() + timeout;
 while (Date.now() < deadline) {
  const count = await win.webContents.executeJavaScript(`Number(document.querySelector('.coin-pile canvas')?.dataset.dynamicBodies||0)`);
  if (count > 0) return count;
  await pause(50);
 }
 throw new Error('金币未按期进入动态物理世界');
};
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
  const model=await win.webContents.executeJavaScript(`(()=>{const root=document.querySelector('.coin-pile'),c=root.querySelector('canvas'),ground=getComputedStyle(root,'::before');return {scene:c.dataset.scene,renderer:c.dataset.renderer,triangles:Number(c.dataset.modelTriangles),physics:c.dataset.physics,physicsError:c.dataset.physicsError,depthSpread:Number(c.dataset.depthSpread),moundCenter:Number(c.dataset.moundCenter),moundEdge:Number(c.dataset.moundEdge),groundVisual:ground.content!=='none'&&ground.backgroundImage!=='none'}})()`);
  win.setSize(920,600);await pause(200);
  const compactLayout=await win.webContents.executeJavaScript(`(()=>{const pile=document.querySelector('.coin-pile').getBoundingClientRect(),foot=document.querySelector('.sidebar-foot').getBoundingClientRect(),nav=document.querySelector('.nav').getBoundingClientRect(),canvas=document.querySelector('.coin-pile canvas');return {noOverlap:pile.bottom<=foot.top,underMore:pile.top-nav.bottom,canvasHeight:canvas.getBoundingClientRect().height,physicsHeight:Number(canvas.dataset.physicsHeight),animating:canvas.dataset.animating}})()`);
  fs.writeFileSync(path.join(output,'compact.png'),(await win.webContents.capturePage()).toPNG());
  win.setSize(1240,820);await pause(200);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了').click()`);
  await pause(150);
  const flightCount = await win.webContents.executeJavaScript(`document.querySelectorAll('.income-flight').length`);
  fs.writeFileSync(path.join(output,'feedback-flight.png'),(await win.webContents.capturePage()).toPNG());
  await pause(650);fs.writeFileSync(path.join(output,'falling-3d.png'),(await win.webContents.capturePage()).toPNG());
  await pause(1200);fs.writeFileSync(path.join(output,'mound-3d.png'),(await win.webContents.capturePage()).toPNG());
  const finalIncome = await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.stat')).find(e=>e.textContent.includes('本月确认收入')).textContent`);
  const start = await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {count:Number(c.dataset.physicsFrames||0),animating:c.dataset.animating}})()`);
  await pause(1000);
  const end=await win.webContents.executeJavaScript(`Number(document.querySelector('.coin-pile canvas').dataset.physicsFrames||0)`);
  await waitForJarIdle(win);
  await pause(250);
  const persistedBeforeReload=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {count:Number(c.dataset.stableBodies||0),signature:c.dataset.pileSignature||''}})()`);
  await win.reload();await pause(600);
  const persistedAfterReload=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {count:Number(c.dataset.stableBodies||0),signature:c.dataset.pileSignature||''}})()`);
  const stackedState=JSON.parse(JSON.stringify(savedState));
  const oldPileMaxY=Math.max(0,...(stackedState.settings.coinPile||[]).map(coin=>coin.position.y));
  stackedState.lessons.push({...fixture(0).lessons.find(lesson=>lesson.status==='scheduled'),id:'stacked',time:'19:00'});
  win.webContents.send('state',stackedState);await pause(250);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了').click()`);
  await waitForJarIdle(win);
  const stackedBeforeReload=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {count:Number(c.dataset.stableBodies||0),signature:c.dataset.pileSignature||''}})()`);
  await pause(250);
  const stackedCoins=(savedState.settings.coinPile||[]).filter(coin=>coin.lessonId==='stacked');
  const stackedEvidence={count:stackedCoins.length,oldPileMaxY,maxY:stackedCoins.length?Math.max(...stackedCoins.map(coin=>coin.position.y)):0,escaped:stackedCoins.filter(coin=>coin.position.y<0||Math.hypot(coin.position.x,coin.position.z)>2).length,beforeReload:stackedBeforeReload};
  await win.reload();await pause(600);
  stackedEvidence.afterReload=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {count:Number(c.dataset.stableBodies||0),signature:c.dataset.pileSignature||''}})()`);
  const undoState=JSON.parse(JSON.stringify(savedState));
  undoState.lessons.push({...fixture(0).lessons.find(lesson=>lesson.status==='scheduled'),id:'undo-active',time:'23:00'});
  win.webContents.send('state',undoState);await pause(250);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了').click()`);
  const undoDynamicBefore=await waitForDynamicCoin(win);
  await win.webContents.executeJavaScript(`(()=>{const buttons=Array.from(document.querySelectorAll('button')).filter(b=>b.title==='撤销打卡（需确认）');buttons.at(-1).click()})()`);
  await pause(100);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='撤销打卡').click()`);
  await waitForJarIdle(win);await pause(250);
  const undoActive=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {stable:Number(c.dataset.stableBodies||0),dynamic:Number(c.dataset.dynamicBodies||0)}})()`);
  const undoEvidence={dynamicBefore:undoDynamicBefore,...undoActive,persistedLessonCoins:(savedState.settings.coinPile||[]).filter(coin=>coin.lessonId==='undo-active').length};
  const crashState=JSON.parse(JSON.stringify(savedState));
  crashState.lessons=crashState.lessons.filter(lesson=>lesson.id!=='undo-active');
  crashState.lessons.push({...fixture(0).lessons.find(lesson=>lesson.status==='scheduled'),id:'crash-recovery',time:'22:00'});
  win.webContents.send('state',crashState);await pause(250);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了').click()`);
  const crashDynamicBeforeReload=await waitForDynamicCoin(win);
  const pendingBeforeReload=(savedState.settings.pendingCoinDrops||[]).filter(drop=>drop.lessonId==='crash-recovery').length;
  await win.reload();await pause(600);await waitForJarIdle(win);await pause(250);
  const crashBeforeSecondReload=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {count:Number(c.dataset.stableBodies||0),signature:c.dataset.pileSignature||''}})()`);
  const recoveredCoins=(savedState.settings.coinPile||[]).filter(coin=>coin.lessonId==='crash-recovery');
  const crashRecovery={dynamicBeforeReload:crashDynamicBeforeReload,pendingBeforeReload,recoveredCoins:recoveredCoins.length,pendingAfterRecovery:(savedState.settings.pendingCoinDrops||[]).filter(drop=>drop.lessonId==='crash-recovery').length,beforeSecondReload:crashBeforeSecondReload};
  await win.reload();await pause(600);
  crashRecovery.afterSecondReload=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {count:Number(c.dataset.stableBodies||0),signature:c.dataset.pileSignature||''}})()`);
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  win.webContents.send('state',fixture(0));await pause(250);
  const forcedEmittedBefore=await win.webContents.executeJavaScript(`Number(document.querySelector('.coin-pile canvas').dataset.emitted||0)`);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了').click()`);
  await pause(100);
  const forcedPendingBefore=await win.webContents.executeJavaScript(`Number(document.querySelector('.coin-pile canvas').dataset.pendingCoins||0)`);
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await waitForJarIdle(win);await pause(250);
  const forcedCanvas=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {count:Number(c.dataset.stableBodies||0),emitted:Number(c.dataset.emitted||0)}})()`);
  const forcedSettlement={pendingBefore:forcedPendingBefore,count:forcedCanvas.count,newCoins:forcedCanvas.emitted-forcedEmittedBefore};
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  win.webContents.debugger.detach();
  const knownBaselineErrors=errors.filter(e=>e.includes('Executing inline script violates'));
  const unexpectedErrors=errors.filter(e=>!knownBaselineErrors.includes(e));
  const double=fixture(0); double.lessons.push({...double.lessons[0],id:'pending2',time:'18:00'});
  win.webContents.send('state',double);await pause(250);
  const doubleBefore=await win.webContents.executeJavaScript(`({buttons:Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='上完了').length,animating:document.querySelector('.coin-pile canvas').dataset.animating})`);
  const emittedBefore=await win.webContents.executeJavaScript(`Number(document.querySelector('.coin-pile canvas').dataset.emitted||0)`);
  const firstClicked=await win.webContents.executeJavaScript(`(()=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了');button.click();return 1})()`);
  await pause(1100);
  const firstDynamic=await win.webContents.executeJavaScript(`Number(document.querySelector('.coin-pile canvas').dataset.dynamicBodies||0)`);
  const secondClicked=await win.webContents.executeJavaScript(`(()=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了');button.click();return 1})()`);
  await pause(1100);
  const secondDynamic=await win.webContents.executeJavaScript(`Number(document.querySelector('.coin-pile canvas').dataset.dynamicBodies||0)`);
  const emittedAfter=await win.webContents.executeJavaScript(`Number(document.querySelector('.coin-pile canvas').dataset.emitted||0)`);
  const canLoseContext=await win.webContents.executeJavaScript(`(()=>{const gl=document.querySelector('.coin-pile canvas').getContext('webgl2'),ext=gl&&gl.getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();setTimeout(()=>ext.restoreContext(),80);return true})()`);
  await pause(500);await waitForJarIdle(win);
  const contextRecovery=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {renderer:c.dataset.renderer,animating:c.dataset.animating,pending:Number(c.dataset.pendingCoins||0),caption:document.querySelector('.coin-pile-caption').textContent}})()`);
  const doubleAfter=await win.webContents.executeJavaScript(`(()=>{const c=document.querySelector('.coin-pile canvas');return {buttons:Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='上完了').length,animating:c.dataset.animating,pending:c.dataset.pendingCoins,nextDelay:c.dataset.nextCoinDelay}})()`);
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  win.webContents.send('state',fixture(0));await pause(100);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='上完了').click()`);await pause(250);
  const reduced=await win.webContents.executeJavaScript(`({animating:document.querySelector('.coin-pile canvas').dataset.animating,emitted:Number(document.querySelector('.coin-pile canvas').dataset.emitted||0),stable:Number(document.querySelector('.coin-pile canvas').dataset.stableBodies||0),flights:document.querySelectorAll('.income-flight').length,caption:document.querySelector('.coin-pile-caption').textContent})`);
  win.webContents.debugger.detach();
  const result={model,compactLayout,flightCount,finalIncome,start,oneSecondLater:end,idleRafDelta:end-start.count,persistence:{beforeReload:persistedBeforeReload,afterReload:persistedAfterReload,stacked:stackedEvidence},undoEvidence,crashRecovery,forcedSettlement,doubleCheckinEmitted:emittedAfter-emittedBefore,doubleFlow:{before:doubleBefore,clicked:firstClicked+secondClicked,firstDynamic,secondDynamic,after:doubleAfter},contextRecovery:{...contextRecovery,supported:canLoseContext},reducedMotion:{...reduced,newCoins:reduced.emitted-emittedAfter},knownBaselineErrors,unexpectedErrors};
  fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  if(model.scene!=="open-ground"||model.renderer!=="webgl2"||model.physics!=="rapier3d-ground"||!model.groundVisual||model.triangles<100||model.depthSpread<.5||model.moundCenter<=model.moundEdge||persistedBeforeReload.count<1||persistedAfterReload.count!==persistedBeforeReload.count||persistedAfterReload.signature!==persistedBeforeReload.signature||stackedEvidence.count!==28||stackedEvidence.maxY<=stackedEvidence.oldPileMaxY||stackedEvidence.escaped!==0||stackedEvidence.beforeReload.count!==persistedAfterReload.count+28||stackedEvidence.afterReload.count!==stackedEvidence.beforeReload.count||stackedEvidence.afterReload.signature!==stackedEvidence.beforeReload.signature||undoEvidence.dynamicBefore<1||undoEvidence.stable!==stackedEvidence.afterReload.count||undoEvidence.dynamic!==0||undoEvidence.persistedLessonCoins!==0||crashRecovery.dynamicBeforeReload<1||crashRecovery.pendingBeforeReload!==1||crashRecovery.recoveredCoins!==28||crashRecovery.pendingAfterRecovery!==0||crashRecovery.beforeSecondReload.count!==undoEvidence.stable+28||crashRecovery.afterSecondReload.count!==crashRecovery.beforeSecondReload.count||crashRecovery.afterSecondReload.signature!==crashRecovery.beforeSecondReload.signature||forcedSettlement.pendingBefore<1||forcedSettlement.count!==28||forcedSettlement.newCoins!==28||!compactLayout.noOverlap||compactLayout.animating!=="false"||Math.abs(compactLayout.physicsHeight-Math.max(1.7,(compactLayout.canvasHeight-45)/56))>.01||!canLoseContext||contextRecovery.renderer!=="webgl2"||contextRecovery.animating!=="false"||contextRecovery.pending!==0||!contextRecovery.caption.includes('560')||reduced.animating!=="false"||reduced.stable!==28||reduced.emitted-emittedAfter!==28||reduced.flights!==0||emittedAfter-emittedBefore!==56||firstDynamic<28||secondDynamic<56||flightCount!==1||!finalIncome.includes('5,280')||start.animating!=='false'||end!==start.count||unexpectedErrors.length)process.exitCode=1;
 }catch(e){console.error(e);process.exitCode=1;}finally{win.destroy();app.exit(process.exitCode||0);}
});
