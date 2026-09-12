# 素材放这里

储蓄罐用的图（生成方式见 `docs/prompt-assets.md`）：

| 文件 | 是什么 |
|---|---|
| `coins.png` | 金币雪碧图，三帧横排：正面 / 35° 侧倾 / 侧立 |
| `medallion.png` | 攒满一罐后收拢成的厚币 |
| `jar-glass.png` | 罐子的**前壁玻璃层**，内部必须是全透明的 |
| `poster-bg.png` | 海报背景纹理（可选） |

罐子的后壁、底部内阴影、金币堆的形状、撒花纸片都是 canvas 画的，不在这里。

Vite 会把这些打进 bundle，CSP 的 `img-src 'self' data:` 允许本地图片。
