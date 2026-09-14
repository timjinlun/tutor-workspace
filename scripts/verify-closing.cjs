/* Exercises the production Electron main/preload in an isolated appData directory. */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'lessonlog-closing-qa-'));
app.setPath('appData',tmp); app.setPath('userData',path.join(tmp,'LessonLog'));
const output = path.resolve('docs/qa/closing'); fs.mkdirSync(output,{recursive:true});
let shareResult;
const netDiagnostics={connections:0,requests:0,ticks:0};
const http=require('node:http');const originalCreate=http.createServer;
http.createServer=(...args)=>{const server=originalCreate(...args);server.on('connection',()=>netDiagnostics.connections++);server.on('request',()=>netDiagnostics.requests++);return server;};
setInterval(()=>netDiagnostics.ticks++,100).unref();
const originalHandle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(name,handler)=>originalHandle(name,async(...args)=>{const result=await handler(...args);if(name==='poster:start')shareResult=result;return result;});
dialog.showSaveDialog=async()=>({canceled:false,filePath:path.join(output,'saved-poster.png')});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const {execFile}=require('node:child_process');
const getImage=url=>new Promise((resolve,reject)=>execFile('/usr/bin/curl',['--noproxy','*','--fail','--silent','--show-error','--max-time','5',url],{encoding:'buffer',maxBuffer:20*1024*1024},(err,out)=>err?reject(err):resolve(out))); 
const date=new Date();const today=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const lesson=(id,time,units,studentId,extra={})=>({id,date:today,time,units,studentId,courseId:'c',price:150,status:'done',source:'manual',createdAt:'',...extra});
const state={version:3,teachers:[],students:[{id:'s1',name:'张明',courseIds:['c'],note:'',createdAt:today,archived:false,sortOrder:0},{id:'s2',name:'李华',courseIds:['c'],note:'',createdAt:today,archived:false,sortOrder:1}],courses:[{id:'c',name:'数学',price:150,unitsPerLesson:1,unitMinutes:30}],classes:[{id:'k',name:'初二数学小班',courseId:'c',studentIds:['s1','s2'],deductOnAbsence:false,active:true}],payments:[],templates:[],lessons:[lesson('a','16:00',2,'s1'),lesson('b','18:00',1,'s2'),lesson('c','20:00',2,'s1',{classId:'k',groupId:'g'}),lesson('d','20:00',2,'s2',{classId:'k',groupId:'g'})],todos:[],expenses:[],otherIncomes:[],leads:[],materials:[],settings:{teacherName:'老师',appearance:'light',accent:'coral',background:'none',unitMinutes:60,lowBalanceThreshold:4,remindAhead:2,onboarded:true,coinValue:{amount:10,month:today.slice(0,7)},jarCapacity:10000}};
try { require(path.resolve('out/main/main.js')); } catch(error) { console.error('MAIN_START_ERROR',error); app.exit(1); }
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
app.whenReady().then(async()=>{
 let win;
 try {
  for(let i=0;i<100;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading()&&win.webContents.getURL())break;await pause(50);}
  if(!win)throw new Error('No window');await pause(300);
  win.webContents.send('data:imported',state);await pause(350);
  const click=async text=>win.webContents.executeJavaScript(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Missing button');b.click()})()`);
  await click('收工');await pause(350);
  if(await win.webContents.executeJavaScript(`document.querySelector('[role="switch"]').checked`))throw new Error('Income should default to hidden');
  fs.writeFileSync(path.join(output,'closing-card.png'),(await win.webContents.capturePage()).toPNG());
  await click('生成海报');
  for(let i=0;i<100;i++){if(shareResult)break;await pause(50);}
  await pause(350);
  fs.writeFileSync(path.join(output,'poster-and-qr.png'),(await win.webContents.capturePage()).toPNG());
  const src=await win.webContents.executeJavaScript(`document.querySelector('.closing-poster').src`);
  const png=Buffer.from(src.split(',')[1],'base64');fs.writeFileSync(path.join(output,'poster.png'),png);
  if(!shareResult?.ok)throw new Error('Share failed: '+JSON.stringify(shareResult));
  let served; let networkError; try { served=await getImage(shareResult.url); } catch(e) {networkError=e.code;}
  const qrVisible=await win.webContents.executeJavaScript(`!!document.querySelector('.closing-qr')`);
  await click('保存到电脑');await pause(150);
  const saved=fs.readFileSync(path.join(output,'saved-poster.png'));
  const oldUrl=shareResult.url;
  await win.webContents.executeJavaScript(`document.querySelector('[role="switch"]').click()`);await pause(200);
  if(await win.webContents.executeJavaScript(`!!document.querySelector('.closing-poster') || !!document.querySelector('.closing-qr')`))throw new Error('Old export remains after toggle');
  let oldClosed=false;try{await getImage(oldUrl);}catch{oldClosed=true;}
  if(!oldClosed)throw new Error('Old share still available');
  shareResult=undefined;
  await click('生成海报');
  for(let i=0;i<100;i++){if(shareResult)break;await pause(50);}
  await pause(350);
  const incomeSrc=await win.webContents.executeJavaScript(`document.querySelector('.closing-poster').src`);
  const incomePng=Buffer.from(incomeSrc.split(',')[1],'base64');
  fs.writeFileSync(path.join(output,'poster-income.png'),incomePng);
  if(incomePng.equals(png))throw new Error('Income toggle did not change export');
  await click('关闭');await pause(150);
  let closed=false;try{await getImage(shareResult.url);}catch{closed=true;}
  const evidence={width:png.readUInt32BE(16),height:png.readUInt32BE(20),httpStatus:served ? 200 : null,servedMatchesPoster:served?.equals(png) ?? false,networkError,netDiagnostics,savedMatchesPoster:saved.equals(png),qrVisible,closed,physicalPhoneScan:'not verified'};
  fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
  if(!closed||!qrVisible||!saved.equals(png))throw new Error('Acceptance failed');
  app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
});
