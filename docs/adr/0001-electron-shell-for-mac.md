# ADR-0001 · v3 的 macOS 壳继续用 Electron

日期：2026-09-12 · 状态：已采纳

## 背景

v3 目标是"像苹果 App 的 Mac 应用"（A 版），将来可能扩到 iPhone / iPad（B 版）。候选壳：Electron、Tauri 2。

## 决定

A 版用 Electron 43。原因：

1. v2 已验证的东西不丢：内置 `node:sqlite`（零 native 依赖）、打包链路、35 项测试覆盖的数据层。
2. Electron 在 macOS 上原生支持 `vibrancy`（侧栏毛玻璃）、`systemPreferences.getAccentColor()`（跟随系统强调色）、`nativeTheme`，"苹果感"需要的平台能力都有。
3. 渲染引擎固定为 Chromium，不用为 WKWebView 的差异分心。

## 代价

包体 ~100MB（压缩后）。将来做 B 版要换 Tauri 2。

## 为换壳留的路

- `src/platform/` 是唯一碰平台能力的地方，接口化。
- `src/data/` 通过 `Repository` 接口访问持久化，Electron 只是其中一个 adapter。
- 换壳 = 重写 `electron/` 目录和这两层的 adapter，`core / store / ui` 不动。
