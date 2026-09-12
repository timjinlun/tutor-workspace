import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import QRCode from "qrcode";
import { useStore } from "@/store";
import { closingDayData } from "@/core/closing-day";
import { todayISO } from "@/core/date";
import type { LanAddress } from "@/core/poster-share-types";
import { platform, isApp } from "@/platform";
import { Button, Sheet } from "@/ui/primitives";
import { drawClosingPoster } from "./closing-poster";
import "./closing-day.css";

export function ClosingDaySheet({ onClose }: { onClose: () => void }) {
  const s = useStore((x) => x.s);
  const ent = useStore((x) => x.ent);
  const data = closingDayData(s, todayISO());
  const host = useRef<HTMLDivElement>(null);
  const session = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const [poster, setPoster] = useState("");
  const [qr, setQr] = useState("");
  const [addresses, setAddresses] = useState<LanAddress[]>([]);
  const [address, setAddress] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const watermark = !ent.can("scorecard.noWatermark");
  useEffect(() => {
    let mounted = true;
    const lifecycle = generation;
    const unsubscribe = useStore.subscribe((next, prev) => {
      if (next.s !== prev.s || next.ent !== prev.ent) {
        lifecycle.current++; setPoster(""); setQr(""); setExpiresAt(0); setBusy(false);
        void platform.posterShare.stop().catch(() => {});
      }
    });
    void platform.posterShare.addresses().then((list) => { if (mounted) { setAddresses(list); setAddress(list[0]?.address ?? ""); } }).catch(() => { if (mounted) setMessage("无法读取网络地址，仍可保存到电脑"); });
    return () => { mounted = false; unsubscribe(); lifecycle.current++; void platform.posterShare.stop().catch(() => {}); };
  }, []);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) { clearInterval(timer); setQr(""); void platform.posterShare.stop(session.current).catch(() => {}); }
    }, 250);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const share = async (image: string) => {
    const request = ++generation.current;
    setBusy(true); setQr(""); setExpiresAt(0); setMessage("");
    try {
      const started = await platform.posterShare.start(image, address || undefined);
      if (request !== generation.current) { if (started.ok) await platform.posterShare.stop(started.sessionId); return; }
      if (!started.ok) { setMessage(started.error); return; }
      session.current = started.sessionId;
      const code = await QRCode.toDataURL(started.url, { width: 224, margin: 2, errorCorrectionLevel: "M" });
      if (request !== generation.current) { await platform.posterShare.stop(started.sessionId); return; }
      setQr(code); setExpiresAt(started.expiresAt); setSeconds(60);
    } catch (error) {
      if (request === generation.current) { setMessage(error instanceof Error ? error.message : "传图暂时不可用，请保存到电脑"); await platform.posterShare.stop(session.current).catch(() => {}); }
    } finally { if (request === generation.current) setBusy(false); }
  };
  const generate = async () => {
    if (!host.current) return;
    const request = ++generation.current;
    setBusy(true);
    try {
      await document.fonts.ready;
      if (!host.current || request !== generation.current) return;
      const css = getComputedStyle(host.current);
      const color = (name: string) => css.getPropertyValue(name).trim();
      const canvas = document.createElement("canvas");
      drawClosingPoster(canvas, data, { paper: color("--poster-paper"), ink: color("--poster-ink"), muted: color("--poster-muted"), line: color("--poster-line"), accent: color("--accent") }, watermark);
      const image = canvas.toDataURL("image/png"); setPoster(image);
      if (isApp) await share(image);
      else setBusy(false);
    } catch (error) { setBusy(false); setMessage(error instanceof Error ? error.message : "海报生成失败，请重试"); }
  };
  const save = async () => {
    try { if (await platform.data.saveImage(poster, `收工_${data.date}.png`)) setMessage("已保存到电脑"); }
    catch { setMessage("保存失败，请重试"); }
  };
  return <MotionConfig reducedMotion="user"><Sheet open onClose={onClose} title="今天收工了" sub={`今天上了 ${data.lessons} 节课，${Number(data.units.toFixed(2))} 课时。`} wide>
    <div ref={host} className="closing-day">
      {poster ? <div className="closing-export">
        <img className="closing-poster" src={poster} alt={`${data.date} 收工海报`} />
        <div className="closing-share">
          <h3>带到手机上</h3>
          {addresses.length > 1 && <label>当前网络<select className="select" value={address} onChange={(e) => { generation.current++; setBusy(false); setAddress(e.target.value); setQr(""); setExpiresAt(0); void platform.posterShare.stop(session.current).catch(() => {}); }}>{addresses.map((a) => <option key={a.address} value={a.address}>{a.label}</option>)}</select></label>}
          {qr && seconds > 0 ? <><img className="closing-qr" src={qr} alt="扫码打开收工海报" /><p className="muted">手机连接同一 Wi-Fi，扫码后长按图片保存。</p><p className="closing-countdown">{seconds} 秒后失效</p></> : <p className="muted">{busy ? "正在准备二维码…" : isApp ? "二维码仅在临时传图期间有效。" : "浏览器版可直接保存海报。"}</p>}
          {isApp && !qr && !busy && <Button onClick={() => void share(poster)}>重新生成二维码</Button>}
          <p className="muted closing-watermark">{watermark ? "免费版带「记一课」水印" : "商业版 · 无水印"}</p>
        </div>
      </div> : <div className="closing-summary"><div className="closing-number">{data.lessons}<span> 节课</span></div><p>这个月已经上了 {data.monthLessons} 节</p><p className="muted">连续第 {data.streak} 天有课</p><div className="closing-coins" aria-hidden="true">{Array.from({length:18}, (_, i) => <i key={i} />)}</div></div>}
      {message && <p className="closing-message" role="status">{message}</p>}
      <div className="sheet-actions"><Button onClick={onClose}>关闭</Button>{poster ? <Button variant="primary" onClick={() => void save()}>保存到电脑</Button> : <Button variant="primary" disabled={busy} onClick={() => void generate()}>生成海报</Button>}</div>
    </div>
  </Sheet></MotionConfig>;
}
