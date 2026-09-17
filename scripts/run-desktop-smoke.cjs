/* Run two separate Electron processes against disposable data, on macOS or Windows. */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const electron = require('electron');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lessonlog-desktop-'));
const dataRoot = path.join(temporary, '中文 用户');
fs.mkdirSync(dataRoot);
const output = path.resolve(`out/qa/desktop-${process.platform}`);
for (const file of ['write.json', 'read.json', 'failure.png']) fs.rmSync(path.join(output, file), { force: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;

function run(phase) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.resolve('scripts/verify-desktop.cjs'), dataRoot, phase], { env, stdio: 'inherit' });
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Desktop ${phase} timed out`)); }, 90000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`Desktop ${phase} exited with ${code}`));
    });
  });
}
(async () => {
  try {
    await run('write');
    await run('read');
    console.log(`DESKTOP_SMOKE_PASS platform=${process.platform} (isolated data; two process launches)`);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
