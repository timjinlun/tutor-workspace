# Windows 版

首轮适配目标为 **Windows 11 x64（Intel / AMD）**。复用 macOS 版的排课、学员、缴费、收支和分享功能，数据仍保存在当前电脑；没有增加登录、云同步或遥测。

## 当前交付范围

- NSIS `.exe` 安装包，默认安装到当前用户目录，不要求为正常使用授予管理员权限。
- 桌面与开始菜单快捷方式，独立应用图标；关闭最后一个窗口即退出。
- Windows 原生标题栏，侧栏无需为 Mac 窗口按钮预留空白。
- Windows 系统强调色读取与实时更新；界面与分享图片补充微软雅黑字体回退。
- 卸载默认保留教学数据。卸载重装不等于清空记录。
- GitHub Actions 同时配置 macOS 与 Windows 构建；手动构建只保留产物，版本标签触发发布。

当前为首个未签名 Windows 版本。自动化检查会在 GitHub 的 Windows 环境中运行；安装、升级、卸载和实体手机扫码仍需按下方清单做人工验收。

## 安装和数据

构建输出为 `dist/LessonLog-<版本>-win-x64.exe`。双击后安装到当前用户目录，可通过桌面或开始菜单启动。

安装包未使用 Windows 代码签名，系统可能显示“未知发布者”或 SmartScreen 提示。仅从本项目 GitHub Release 下载；无需关闭系统安全软件。

默认数据文件为：

```text
%APPDATA%\LessonLog\data\data.db
```

在「设置 → 你的数据」中可直接打开数据文件夹、备份到 `.db` 或导出 JSON。自动快照与原数据库位于同一位置，重要记录应另存备份。

从 Mac 迁移时，在 Mac 导出 JSON，再在 Windows 导入。**导入会替换目标电脑的当前记录**，请先备份；自定义壁纸需重新选择。两个平台没有自动同步。

手机扫码保存收工海报仍需连接同一 Wi-Fi。Windows 防火墙可能影响局域网访问，无法连接时可直接保存到电脑；应用不会自动添加防火墙规则。

## 本地开发与打包

需要 Node.js 24 或更高版本。首次在 Windows 开发机上运行：

```powershell
npm ci
npm run dev
```

打包及验证：

```powershell
npm test
npm run typecheck
npm run lint
npm run build:win
npm run test:desktop
```

`test:desktop` 会启动两次真实 Electron 进程，在含中文与空格的临时目录中检查数据保存及重启恢复，覆盖记课、撤销、缴费、SQLite 备份、JSON 导入导出和 PNG 导出。文件选择对话框由测试替代，实际文件读写仍使用生产代码；不会访问日常使用的数据目录。

测试截图和结果在 `out/qa/desktop-win32/`；Mac 上执行则为 `out/qa/desktop-darwin/`，不能用后者代替 Windows 的验证证据。这个检查加载构建后的应用代码，不负责验证 NSIS 安装、升级或卸载。

当前锁定的 electron-builder 支持从 Mac 交叉生成 Windows 包。但 Windows 上的安装与运行验证仍须在 Windows 机器执行，不以交叉打包代替。

## 自动构建

`.github/workflows/build.yml` 的 Windows 任务使用 `windows-latest`，依次完成依赖安装、单元测试、类型检查、静态检查、打包和桌面检查。任何一步失败都不会上传可发布安装包。

- 手动运行工作流：可从该次运行的 Artifacts 下载 `windows-latest-installer`。
- 推送 `v*` 标签：两个平台检查通过后，安装包进入同一 GitHub Release。
- 检查截图与结果单独保存在 `*-desktop-check`，不会混入发布附件。

Windows 签名目前由 `package.json` 中的 `build.win.signExecutable: false` 关闭，图标及版本信息仍会写入。正式启用签名时需移除该选项，并通过构建环境配置证书；不要把凭据写入仓库。

## 首发前验证记录

2026-09-17 本地收尾核对基于 v3.6.1 发布代码。GitHub Release 以 Windows CI 的检查结果和产物为准。

| 检查 | 结果与范围 |
|---|---|
| 自动化测试 | 29 个测试文件、122 项测试通过 |
| 类型与静态检查 | 通过；现有 ESLint 配置的弃用警告仍存在 |
| Windows x64 打包 | 在 macOS 交叉构建 NSIS 安装包成功 |
| 安装包内容 | x64 可执行程序、图标和版本信息已检查；封装的主进程、桥接层及界面资源与已验证构建一致 |
| 桌面流程 | macOS 上真实 Electron 的记课、撤销、缴费、备份、导入导出、两次进程启动的数据一致性检查通过 |
| Windows 布局 | macOS 上预览 Windows 侧栏样式已复核；不能代替 Windows 字体、原生窗口及缩放验收 |
| Windows CI | 发布标签触发后在 `windows-latest` 运行同一套测试、构建和桌面流程检查 |
| Windows 人工安装 | 当前环境没有 Windows 测试机，安装、升级、卸载与实体手机扫码尚待人工验收 |

本地交叉构建的候选包仅用于预检。正式安装包及其摘要以 GitHub Release 附件为准。

## Windows 发布前验收

在 Windows 11 x64 普通用户账户下完成以下检查，并记录系统版本、缩放比例和结果：

- [ ] 下载并运行安装包，检查快捷方式、应用图标、首次启动及卸载入口。
- [ ] 新建课程和学员，排课、打卡、撤销、缴费；退出重开后记录一致。
- [ ] 核对确认收入与实际到账，验证班课点名和合作老师课时费。
- [ ] 中文用户名、中文及空格路径下完成备份、JSON 导入导出、图片保存和壁纸选择。
- [ ] 浅色、深色、系统强调色切换；100%、125%、150% 显示缩放下检查页面、表单与弹窗。
- [ ] 确认收工海报和成绩卡中文清晰、尺寸正确；在同一 Wi-Fi 下用实体手机扫码保存。
- [ ] 覆盖安装后数据保留；卸载再安装后数据仍可读取。
- [ ] 在 Windows 运行 `npm run test:desktop`，检查两次进程启动均通过。

Windows ARM64、32 位系统和其他 Windows 版本不在本轮验收范围内。
