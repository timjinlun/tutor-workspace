# 储蓄罐交接

2026-09-12：按 docs/spec-储蓄罐.md 交付 P0，顺序 P0-1 → P0-2 → P0-3。

## 已确认口径

- 第一罐累计全部已确认收入；满罐保留金额，P0 不倒罐。
- coinValue 保存 { amount, month }；jarCapacity 保存金额。
- 参考图只取形状与厚度，使用应用强调色，不使用金色图片。
- 收工班课按场次统计；3 人上 2 课时 = 1 节、2 课时。

## 当前状态

P0-1 已实现，51 个测试、类型检查和构建通过。隔离 Electron 四态截图及空闲 rAF 证据在 docs/qa/jar。
P0-2 已实现，53 个测试通过；飞行截图、最终金额与静止证据已验证。P0-3 待实现。未合并、未发布。

## 验证

npm test
npm run typecheck
npm run build
./node_modules/.bin/electron scripts/verify-jar.cjs

脚本使用临时目录和内存数据，绝不打开正式数据库。
原有 src/index.html 内联外观恢复脚本被 CSP 阻止，验收 evidence.json 单列该基线问题；未放宽 CSP。
