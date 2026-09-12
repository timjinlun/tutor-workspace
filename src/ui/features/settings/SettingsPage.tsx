/** 设置：称呼、外观、课程与单价、老师、你的数据。这里不出现「数据库」三个字。 */
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { FolderOpen, Download, Upload, Save, ImagePlus, X } from "lucide-react";
import { useStore } from "@/store";
import type { Accent, Appearance, Background } from "@/core/types";
import { Button, Field, Input, Segmented } from "@/ui/primitives";
import { ConfirmSheet } from "@/ui/widgets/ConfirmSheet";
import { platform, isApp } from "@/platform";

export function SettingsPage() {
  const s = useStore((x) => x.s);
  const { updateSettings, replaceState, loadDemo, clearAll } = useStore(useShallow((x) => ({ updateSettings: x.updateSettings, replaceState: x.replaceState, loadDemo: x.loadDemo, clearAll: x.clearAll })));
  const [info, setInfo] = useState<{ path: string; sizeBytes: number; snapshots: number } | null>(null);
  const wallpaper = useStore((x) => x.wallpaper);
  const setWallpaper = useStore((x) => x.setWallpaper);
  const pickWallpaper = async () => {
    const url = await platform.wallpaper.pick();
    if (!url) return;
    if (await platform.wallpaper.set(url)) {
      setWallpaper(url);
      updateSettings({ background: "custom" });
    }
  };
  const clearWallpaper = async () => {
    await platform.wallpaper.clear();
    setWallpaper(null);
    updateSettings({ background: "aurora" });
  };
  const [confirm, setConfirm] = useState<"demo" | "clear" | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void platform.data.info().then(setInfo);
  }, [s]);

  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  return (
    <div className="page">
      <div className="page-head"><h1>设置</h1></div>

      <div className="card">
        <div className="section-title">我</div>
        <Field label="称呼（用在续费提醒里）"><Input value={s.settings.teacherName} onChange={(e) => updateSettings({ teacherName: e.target.value })} /></Field>
        <div className="grid-2">
          <Field label="剩余课时 ≤ 多少时提醒"><Input type="number" min={0} value={s.settings.lowBalanceThreshold} onChange={(e) => updateSettings({ lowBalanceThreshold: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="再提前几节开始预警"><Input type="number" min={0} value={s.settings.remindAhead} onChange={(e) => updateSettings({ remindAhead: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        </div>
      </div>

      <div className="card">
        <div className="section-title">外观</div>
        <div className="grid-2">
          <Field label="强调色">
            <Segmented<Accent> value={s.settings.accent} options={[{ value: "coral", label: "珊瑚" }, { value: "indigo", label: "靛蓝" }, { value: "system", label: "跟随系统" }]} onChange={(accent) => updateSettings({ accent })} />
          </Field>
          <Field label="深浅色">
            <Segmented<Appearance> value={s.settings.appearance} options={[{ value: "system", label: "跟随系统" }, { value: "light", label: "浅色" }, { value: "dark", label: "深色" }]} onChange={(appearance) => updateSettings({ appearance })} />
          </Field>
        </div>
        <Field label="背景">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Segmented<Background> value={s.settings.background} options={[{ value: "none", label: "纯色" }, { value: "aurora", label: "极光" }, { value: "mesh", label: "网格" }, ...(wallpaper ? [{ value: "custom" as Background, label: "我的图片" }] : [])]} onChange={(background) => updateSettings({ background })} />
            <Button icon={<ImagePlus />} onClick={pickWallpaper}>{wallpaper ? "换一张图片…" : "用自己的图片…"}</Button>
            {wallpaper && <Button variant="ghost" size="sm" icon={<X />} onClick={clearWallpaper}>移除图片</Button>}
          </div>
        </Field>
        {wallpaper && <div className="wallpaper-preview" style={{ backgroundImage: `url(${wallpaper})` }} />}
        <div className="muted" style={{ fontSize: 12.5 }}>有背景时卡片会变成半透明的毛玻璃。图片只存在这台电脑上，不进数据备份。</div>
      </div>

      <div className="card">
        <div className="section-title">储蓄罐</div>
        <Field label="罐子容量">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[5000, 10000, 20000].map((n, i) => <Button key={n} variant={s.settings.jarCapacity === n ? "primary" : "secondary"} onClick={() => updateSettings({ jarCapacity: n })}>{["小罐", "中罐", "大罐"][i]} · ¥{n.toLocaleString("zh-CN")}</Button>)}
          </div>
        </Field>
        <Field label="自定义金额（元）"><Input type="number" min={1} step={1} value={s.settings.jarCapacity} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 1) updateSettings({ jarCapacity: Math.round(n) }); }} /></Field>
        <p className="muted">本月每枚币约 ¥{s.settings.coinValue.amount}。罐内金额按已上课收入累计，撤销时同步扣回。</p>
      </div>

      <div className="card">
        <div className="section-title">你的数据</div>
        <p className="muted" style={{ marginBottom: 12, fontSize: 13.5 }}>
          {isApp ? <>全部数据存在这台电脑上，每次改动自动保存，另有 {info?.snapshots ?? 0} 份自动快照。{info && <> 文件 {(info.sizeBytes / 1024).toFixed(0)} KB。</>}</> : <>浏览器版的数据存在这个浏览器里，记得定期导出。</>}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isApp && <Button icon={<Save />} onClick={async () => { const r = await platform.data.backup(); if (r.ok) say("已备份"); }}>备份到文件…</Button>}
          <Button icon={<Download />} onClick={async () => { const r = await platform.data.exportJSON(s); if (r.ok) say("已导出"); }}>导出 JSON…</Button>
          <Button icon={<Upload />} onClick={async () => { const st = await platform.data.importJSON(); if (st) { replaceState(st, "data.import"); say("已导入"); } }}>从 JSON 导入…</Button>
          {isApp && <Button icon={<FolderOpen />} onClick={() => platform.data.revealFolder()}>打开数据文件夹</Button>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Button variant="ghost" onClick={() => setConfirm("demo")}>载入示例数据</Button>
          <Button variant="danger" onClick={() => setConfirm("clear")}>清空全部数据</Button>
        </div>
        {msg && <div className="chip green" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      <div className="card">
        <div className="section-title">关于</div>
        <div className="muted" style={{ fontSize: 13.5 }}>记一课 v3 · 开源免费版 · MIT · <button className="link" onClick={() => platform.openExternal("https://github.com/timjinlun/tutor-workspace")}>GitHub</button></div>
      </div>

      <ConfirmSheet open={confirm === "demo"} onClose={() => setConfirm(null)} onConfirm={loadDemo} title="用示例数据覆盖当前数据？" confirmLabel="覆盖"><p className="muted">当前的学员、缴费、打卡都会被替换。导入前会自动存一份快照。</p></ConfirmSheet>
      <ConfirmSheet open={confirm === "clear"} onClose={() => setConfirm(null)} onConfirm={clearAll} title="清空全部数据？" confirmLabel="清空"><p className="muted">设置保留，其余全部删除。</p></ConfirmSheet>
    </div>
  );
}
