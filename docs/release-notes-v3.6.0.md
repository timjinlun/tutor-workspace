# 记一课 v3.6.0 · Windows 版与完整学员档案

这是记一课首次同时提供 macOS 和 Windows 安装包的版本，也完成了学员档案与教学管理的结构升级。

## 新功能

- **Windows 11 x64 版**：提供当前用户安装的 `.exe`，支持原生标题栏、系统强调色、中文字体、桌面和开始菜单快捷方式。
- **完整学员档案**：记录年级、学校、监护人、联系方式、学习目标、沟通偏好、授课方式和自定义标签。
- **学习记录**：课堂观察可关联已完成课程，默认仅自己可见；主动标记后才能进入家长反馈。
- **历史查询**：学习记录、上课和缴费支持按月筛选与分页。
- **家长反馈与续费提醒**：支持预览、编辑和复制，不会自动发送。
- **教学管理重组**：课程、班级、老师拆成三个独立标签页，分别管理收费、成员和结算。
- **壁纸体验修复**：完善选择、保存、移除和失败反馈。

## 下载

- Apple Silicon Mac：`LessonLog-3.6.0-arm64.dmg`
- Intel Mac：`LessonLog-3.6.0-x64.dmg`
- Windows 11 Intel / AMD：`LessonLog-3.6.0-win-x64.exe`

Windows ARM64、32 位 Windows、iPhone 和 iPad 暂不支持。Mac 与 Windows 没有自动同步，可通过「设置 → 你的数据 → 导出 JSON / 从 JSON 导入」迁移，导入前请先备份。

## 安装提示

当前安装包尚未使用 Apple 或 Windows 开发者签名：

- Windows 可能显示 SmartScreen「未知发布者」，请确认从本项目 Release 下载后再选择继续。
- Mac 首次打开若被拦截，可在「系统设置 → 隐私与安全」选择仍要打开；详细方法见 README。

## 验证

- 29 个测试文件、122 项自动化测试
- TypeScript 类型检查和模块边界检查
- macOS arm64 / x64 与 Windows x64 打包
- 真实 Electron 两次进程启动的数据一致性检查
- 记课、撤销、缴费、SQLite 备份、JSON 导入导出、PNG 导出及审计流程

Windows 构建在 GitHub `windows-latest` runner 上执行上述检查。Windows 安装、覆盖升级、卸载和实体手机扫码尚未人工验收；安装包未签名。
