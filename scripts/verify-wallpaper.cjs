/* Run: node_modules/.bin/electron scripts/verify-wallpaper.cjs
 * Real Chromium image decoding under the production CSP. Only the OS file
 * chooser is substituted; no production window, settings or database is used.
 */
const { app, BrowserWindow } = require('electron');
const { buildSync } = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lessonlog-wallpaper-test-'));
app.setPath('userData', temp);
const html = fs.readFileSync(path.resolve('src/index.html'), 'utf8');
const csp = html.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)[0];
const fixture = path.join(temp, 'fixture.html');
fs.writeFileSync(fixture, `<!doctype html><html><head>${csp}</head><body></body></html>`);
const bundle = buildSync({ entryPoints: ['src/platform/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'wallpaperTest', platform: 'browser' }).outputFiles[0].text;
const watchdog = setTimeout(() => { console.error('Wallpaper regression timed out'); app.exit(1); }, 20000);

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await win.loadFile(fixture);
    await win.webContents.executeJavaScript(bundle);
    const result = await win.webContents.executeJavaScript(`(async () => {
      const violations = [];
      document.addEventListener('securitypolicyviolation', e => violations.push(e.blockedURI));
      const canvas = document.createElement('canvas');
      canvas.width = 3000; canvas.height = 1500;
      canvas.getContext('2d').fillRect(0, 0, 3000, 1500);
      const bytes = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const realClick = HTMLInputElement.prototype.click;
      const choose = async (file, cancel = false) => {
        HTMLInputElement.prototype.click = function () {
          const input = this;
          queueMicrotask(() => {
            if (cancel) input.dispatchEvent(new Event('cancel'));
            else {
              const files = new DataTransfer();
              if (file) files.items.add(file);
              input.files = files.files;
              input.dispatchEvent(new Event('change'));
            }
          });
        };
        let timer;
        try {
          const value = await Promise.race([
            wallpaperTest.platform.wallpaper.pick(),
            new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Selection did not settle')), 3000); }),
          ]);
          return { value };
        } catch (error) { return { error: error.message }; }
        finally { clearTimeout(timer); HTMLInputElement.prototype.click = realClick; }
      };
      const selected = await choose(new File([bytes], 'fixture.png', { type: 'image/png' }));
      let dimensions = null;
      if (selected.value) {
        const image = new Image(); image.src = selected.value; await image.decode();
        dimensions = [image.naturalWidth, image.naturalHeight];
      }
      const cancelled = await choose(null, true);
      const invalid = await choose(new File(['not an image'], 'broken.png', { type: 'image/png' }));
      return { selected: { ...selected, value: selected.value?.slice(0, 23) ?? selected.value }, dimensions, cancelled, invalid, violations,
        remainingInputs: document.querySelectorAll('input[type=file]').length };
    })()`);
    console.log(JSON.stringify(result));
    assert.equal(result.selected.value, 'data:image/jpeg;base64,', 'Selected PNG must decode under the production CSP');
    assert.deepEqual(result.dimensions, [2000, 1000]);
    assert.equal(result.cancelled.value, null, 'Cancel must settle without an error');
    assert.match(result.invalid.error ?? '', /图片/);
    assert.deepEqual(result.violations, []);
    assert.equal(result.remainingInputs, 0);
    console.log('Wallpaper regression: PASS (CSP, decode, resize, cancel, invalid file, cleanup)');
    clearTimeout(watchdog); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(watchdog); app.exit(1); }
});
