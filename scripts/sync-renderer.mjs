/**
 * 把上一级目录里的「独立老师工作台.html」同步进 renderer/index.html。
 *
 * 那一份 HTML 是唯一真源：既是单文件商品版（浏览器打开走 localStorage、字体走 CDN），
 * 也是这个桌面 App 的界面（走 SQLite、字体走本地）。同步时只改两处 <link> 指向本地字体，
 * 其余一个字节不动。
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "src", "index.html");
const dst = resolve(here, "..", "renderer", "index.html");
const fontsDir = resolve(here, "..", "renderer", "fonts");

if (!existsSync(src)) { console.error(`[sync] 找不到源文件：${src}`); process.exit(1); }

/* 字体不在就先拉（CI 上第一次会走这里） */
if (!existsSync(join(fontsDir, "wenkai", "style.css")) || !existsSync(join(fontsDir, "plex", "plex.css"))) {
  execFileSync(process.execPath, [join(here, "fetch-fonts.mjs")], { stdio: "inherit" });
}

let html = readFileSync(src, "utf8");
const swaps = [
  [/<link id="font-plex" rel="stylesheet" href="[^"]+">/, '<link id="font-plex" rel="stylesheet" href="fonts/plex/plex.css">'],
  [/<link id="font-wenkai" rel="stylesheet" href="[^"]+">/, '<link id="font-wenkai" rel="stylesheet" href="fonts/wenkai/style.css">'],
];
let n = 0;
for (const [re, to] of swaps) if (re.test(html)) { html = html.replace(re, to); n++; }
writeFileSync(dst, html);
console.log(`[sync] ${src}\n    →  ${dst}  (${(statSync(dst).size / 1024).toFixed(0)} KB, ${n} 处字体链接改为本地)`);
