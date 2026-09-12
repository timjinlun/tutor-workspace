/**
 * 把两套字体拉到 renderer/fonts/ 供离线打包（已存在则跳过）。
 *   霞鹜文楷 Screen（楷体，课本字）  npm: lxgw-wenkai-screen-webfont
 *   IBM Plex Serif（账本数字）       Google Fonts
 * CI 上 npm run sync 会自动调用。
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "renderer", "fonts");
const wk = join(root, "wenkai"), px = join(root, "plex");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

if (!existsSync(join(wk, "style.css"))) {
  mkdirSync(wk, { recursive: true });
  const tgz = join(root, "wenkai.tgz");
  execSync(`curl -sL --max-time 300 -o "${tgz}" https://registry.npmjs.org/lxgw-wenkai-screen-webfont/-/lxgw-wenkai-screen-webfont-1.7.0.tgz`, { stdio: "inherit" });
  execSync(`tar -xzf "${tgz}" -C "${wk}" --strip-components=1 && rm -f "${tgz}"`, { stdio: "inherit" });
  console.log("[fonts] 霞鹜文楷 ready");
} else console.log("[fonts] 霞鹜文楷 已存在，跳过");

if (!existsSync(join(px, "plex.css"))) {
  mkdirSync(px, { recursive: true });
  const cssUrl = "https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;1,400&display=swap";
  let css = execSync(`curl -sL -A "${UA}" "${cssUrl}"`).toString();
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])];
  urls.forEach((u, i) => {
    const f = `plex-${i + 1}.woff2`;
    execSync(`curl -sL --max-time 60 -o "${join(px, f)}" "${u}"`);
    css = css.split(u).join(f);
  });
  writeFileSync(join(px, "plex.css"), css);
  console.log(`[fonts] IBM Plex Serif ready (${urls.length} files)`);
} else console.log("[fonts] IBM Plex Serif 已存在，跳过");
