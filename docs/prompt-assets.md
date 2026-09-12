# 给图像模型的素材生成提示词

用途：「记一课」侧边栏储蓄罐。生成完把 PNG 发回来，我接进 canvas 做物理和 UI。

**通用要求（每次生成都要带上）**：

- 输出 **PNG，透明背景（alpha channel）**，不要白底、不要灰格子底
- **正交视角**（orthographic / straight-on），不要透视变形、不要相机畸变
- 物体**居中**，四周留 5% 空白
- **不要投影到地面**（no ground shadow / no cast shadow），物体自身的明暗保留
- 不要文字、不要 logo、不要货币符号、不要 emoji
- 风格：现代 3D 图标质感（像 iOS 26 的系统图标、Figma 里的 3D 插画），
  **不要照片写实、不要卡通描边、不要塑料反光**

---

## 素材 1：金币雪碧图（最重要）

> ⚠️ 三种角度必须**在同一张图里一次生成**。分三次生成的话打光和材质会对不上，
> 堆在罐子里立刻露馅。

**Prompt：**

```
A sprite sheet of three gold coins arranged in a horizontal row on a fully transparent
background, rendered in a clean modern 3D icon style.

Coin 1 (left): perfect top-down circular face, seen straight on.
Coin 2 (middle): the same coin tilted about 35 degrees toward the viewer, so both the
circular face and a sliver of the coin's edge thickness are visible.
Coin 3 (right): the same coin standing on its edge, seen from the side, showing only
the cylindrical rim.

All three coins are identical in material, size and lighting: warm matte gold, soft
brushed metal surface, gently rounded bevel on the rim, a subtle darker gold ring just
inside the face edge, no engraving, no symbols, no text, no patterns on the face.

Lighting: single soft key light from the upper left, gentle ambient fill, no harsh
specular hotspot, no mirror reflection, no glossy plastic sheen. The gold should look
soft and tactile, like matte enamel over metal, not like a shiny photorealistic
bullion coin.

Orthographic projection, coins centered in their thirds, equal spacing, no ground
shadow, no background elements. Fully transparent background.

Square image, 1536 x 512, high detail.
```

**验收标准**（不满足就重生成，别将就）：

- 背景是真的透明，不是白色或浅灰
- 三枚币**大小一致、打光方向一致、金色色调一致**
- 币面上干净，没有任何花纹、数字、货币符号
- 不刺眼，没有强烈的高光斑
- 边缘干净，没有半透明的白边或杂色

---

## 素材 2：厚币（攒满一罐后收拢成的那一枚）

**Prompt：**

```
A single thick gold medallion on a fully transparent background, rendered in a clean
modern 3D icon style.

It looks like many thin coins compressed and fused into one solid disc: the rim shows
faint horizontal striations suggesting stacked layers, but the top face is smooth and
uninterrupted. Blank face, no engraving, no text, no symbols.

Proportions: the disc is noticeably thick, roughly 1 unit tall for every 4 units of
diameter. Seen at a slight tilt, about 25 degrees toward the viewer, so the top face
and the layered rim are both clearly visible.

Material: warm matte gold, same tone as a soft brushed metal, gentle bevel on both the
top and bottom edges of the rim. Single soft key light from the upper left, no harsh
specular highlight, no mirror reflection.

Orthographic projection, centered, no ground shadow, no background. Fully transparent
background. 1024 x 1024.
```

**验收标准**：跟素材 1 的金币**同一个金色**（并排放要像同一批东西），厚度明显，侧面能看出层叠感。

---

## 素材 3：罐子的前壁玻璃（只要前面这一层）

> ⚠️ 这张最容易生成错。关键是**罐子内部必须完全透明**，只保留玻璃本身的高光和边缘。
> 如果生成出来内部有一层雾或者白，金币就会被糊住，这张就废了。

**Prompt：**

```
The FRONT-FACING GLASS SHELL ONLY of an empty clear acrylic cylindrical coin bank,
on a fully transparent background.

Shape: a straight vertical cylinder, flat circular top with a single narrow horizontal
coin slot cut into it, flat circular bottom. Proportions roughly 2 units wide by 3
units tall. Seen straight on at eye level, orthographic, no perspective distortion.

CRITICAL: the interior of the cylinder must be 100% transparent — completely empty
alpha, no haze, no frost, no tint, no white fill, no blur. Only render what glass
itself would show: the thin outlines of the rim and base, the elliptical top opening,
the coin slot, and soft specular highlights.

Render only these elements:
- A thin crisp outline of the cylinder's left and right walls
- The elliptical top rim, drawn as a thin double line suggesting the thickness of the
  acrylic, with the narrow coin slot across its center
- The elliptical bottom edge, slightly thicker and softer
- Two soft vertical highlight bands: one near the left wall, one near the right wall,
  white at about 12% opacity fading to nothing toward the center
- A short crescent of brighter highlight along the upper left of the top rim

The glass is colorless and ultra clear, like optical acrylic. No color tint, no green
or blue cast, no rainbow refraction, no caustics, no reflections of an environment,
no visible background through it, no ground shadow, no table, no contents, no coins,
no label, no text.

Fully transparent background. 1024 x 1536.
```

**验收标准**（这张最严）：

- 把图放到**纯黑背景**上看：内部应该是全黑的（说明真的透明），只看得见几条细线和高光
- 再放到**纯白背景**上看：内部应该是全白的，玻璃线条依然清晰
- 两个测试都过，才是可用的
- 边缘线要细（看起来像 1–2px 的实物边），不要粗黑描边
- 没有任何颜色偏色（不能发绿发蓝）

如果生成的图内部总是有一层雾，换个说法再试：
`"only the outline and highlights of the glass, everything else must be empty alpha"`。

---

## 素材 4（可选）：海报背景纹理

只在「收工海报」和「倒罐成就海报」上用，1080 × 1350 的竖图背景。

**Prompt：**

```
An extremely subtle abstract background texture for a mobile share poster, portrait
orientation 1080 x 1350.

A very soft warm gradient from a pale cream tone at the top to a slightly warmer sand
tone at the bottom, with two barely visible large soft-edged light blooms in the upper
left and lower right. Add an almost imperceptible fine paper grain over the whole
image.

The texture must be quiet enough that dark text and small graphics placed on top
remain perfectly legible — think of premium stationery, not a wallpaper. No objects,
no patterns, no shapes, no text, no vignette, no dark areas.
```

**验收标准**：把黑色小字盖上去，每个字都清清楚楚。只要有一处看不清就是太花了。

---

## 我自己画、不用生成的部分（说明一下，免得你重复生成）

| 东西 | 为什么不用图 |
|---|---|
| 罐子后壁、底部内阴影 | 就是两条弧线加一层径向渐变，画比生成可控，而且要跟着深浅色模式变 |
| 撒花纸片 | canvas 画细长矩形，颜色跟随主题色、角度随机。用图就只能是固定颜色 |
| 界面图标 | 已经在用 `lucide-react`，风格统一 |
| 液面 / 金币堆的整体形状 | 必须由物理算出来，不能是预设图 |

---

## 发回来的时候

每张图告诉我它是素材几就行。我这边会做：

1. 切成 @1x / @2x（视网膜屏要 2 倍图）
2. 金币雪碧图切成三帧，接进物理系统当贴图
3. 罐子玻璃层做成前景，金币画在它下面
4. 深色模式下给玻璃层降低不透明度、给金币提亮

**如果某张怎么生成都不对**（尤其是素材 3 的罐子），告诉我，我用 canvas 画一版——
罐子本身线条简单，手画的下限比生成的下限高，只是质感差一点。
