# 储蓄罐交接

2026-09-12：按 docs/spec-储蓄罐.md 交付 P0，顺序 P0-1 → P0-2 → P0-3。

## 已确认口径

- 第一罐累计全部已确认收入；满罐保留金额，P0 不倒罐。
- coinValue 保存 { amount, month }；jarCapacity 保存金额。
- 最新确认：参考图金色金属金币，罐体与金币均为真实WebGL网格，提供GLB模型与拖动旋转。用户后续指定修长圆柱鱼缸比例，紧接「更多」下面；高度自适应，硬币不拉伸。
- 收工班课按场次统计；3 人上 2 课时 = 1 节、2 课时。

## 当前状态

P0-1/P0-2/P0-3 代码均已实现，完整交付说明在 docs/储蓄罐交付.md。
P0-1 四态截图、静止rAF为0；连续两次打卡56枚已验证。
P0-3 正式Electron HTTP 200、返回字节/保存文件与海报一致、关闭清理均已验证。
实体手机扫码与长按保存未验证；未合并、未发布。
独立只读审查发现的连续反馈覆盖问题已修复并复核。

## 验证

npm test
npm run typecheck
npm run lint
npm run build
node scripts/benchmark-jar.mjs
./node_modules/.bin/electron scripts/verify-jar.cjs
./node_modules/.bin/electron scripts/verify-closing.cjs

脚本使用临时目录和内存数据，绝不打开正式数据库。
原有 src/index.html 内联外观恢复脚本被 CSP 阻止，验收 evidence.json 单列该基线问题；未放宽 CSP。

三维模型：src/core/jar-mesh.ts；渲染：src/ui/widgets/jar-webgl.ts；物理：src/core/jar-physics-3d.ts；导出：node scripts/export-jar-models.mjs。Rapier 圆柱刚体已接入落币、堆叠、碰撞和拖拽倾斜；旋转不改变账目。
