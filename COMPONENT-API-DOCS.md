# 组件接口

## SavingsJar

`src/ui/widgets/SavingsJar.tsx` 从 Zustand store 读取账目状态，不接收 props。组件通过 `JarFeedback` 响应打卡和撤销，通过 `jarState()` 计算金额与容量。

- 渲染：原生 WebGL 2；罐体和金币使用真实三维网格。
- 物理：`createJarPhysics3D({ height, radius })` 返回隔离的 Rapier 世界。
- 活跃金币：最多 240 个圆柱刚体，姿态包含三维位置、四元数、半径和半厚度。
- 历史金额：重建为最多 1200 枚、按厚度 1.02 倍密排的有界静态网格；三层同心碰撞台阶承托动态表层。
- 拖拽：`setJarTilt(x, z)` 更新运动学罐体并唤醒动态金币。
- 生命周期：全部金币休眠后停止动画帧；卸载时释放 WebGL 与 Rapier 资源。
- 持久化：只保存 `coinValue` 与 `jarCapacity`，不保存刚体姿态。
- 减少动态效果：跳过落币与飞行动画，立即按账目重建。

`src/core/jar-physics-3d.ts` 的显式 `position` 使用世界坐标；省略时，金币从当前罐体姿态下的投币口局部坐标生成。
