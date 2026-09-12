/**
 * 没有 Apple 开发者证书时，electron-builder 会整个跳过签名，
 * 下载后 macOS 会说「已损坏，请移到废纸篓」。
 * 这里补一个 ad-hoc 签名：不需要证书，macOS 会改口成「无法验证开发者」，
 * 右键 → 打开就能用。买了证书以后这段自动不生效（已有真签名就跳过）。
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  /* x64 的 Electron 二进制完全没签名，codesign -dv 会直接报错，当作"未签名"处理 */
  let info = "";
  try {
    info = execFileSync("codesign", ["-dv", "--verbose=2", app], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).toString();
  } catch (e) {
    info = String(e.stderr ?? "");
  }
  if (/Authority=Developer ID|Authority=Apple/.test(info)) return;
  const id = context.packager.appInfo.id;
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--identifier", id, "--timestamp=none", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
  console.log(`  • ad-hoc signed ${path.basename(app)} as ${id}`);
};
