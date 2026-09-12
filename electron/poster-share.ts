import { createServer, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";
import type { LanAddress, ShareResult } from "../src/core/poster-share-types";

interface NetworkAddress { address: string; family: string; internal: boolean }
export function lanAddresses(interfaces: Record<string, NetworkAddress[] | undefined>): LanAddress[] {
  const found = new Map<string, LanAddress>();
  for (const [name, values] of Object.entries(interfaces)) for (const value of values ?? []) {
    const p = value.address.split(".").map(Number);
    const privateIP = p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) && (p[0] === 10 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1]! >= 16 && p[1]! <= 31));
    if (!value.internal && value.family === "IPv4" && privateIP) found.set(value.address, { address: value.address, label: `${name} · ${value.address}` });
  }
  return [...found.values()];
}

interface Session { id: string; server: Server; timer?: ReturnType<typeof setTimeout> }

export class PosterShare {
  private active: Session | undefined;
  private revision = 0;
  constructor(readonly addresses: () => LanAddress[] = () => lanAddresses(networkInterfaces()), private readonly ttl = 60000) {}

  async start(dataUrl: unknown, address?: string): Promise<ShareResult> {
    const revision = ++this.revision;
    await this.closeActive();
    if (revision !== this.revision) return { ok: false, error: "分享已取消" };
    if (typeof dataUrl !== "string" || dataUrl.length > 20 * 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)) return { ok: false, error: "海报图片格式不正确" };
    const png = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
    if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || png.readUInt32BE(16) !== 1080 || png.readUInt32BE(20) !== 1350) return { ok: false, error: "海报需要是 1080 × 1350 PNG" };
    const available = this.addresses();
    const host = address ? available.find((a) => a.address === address)?.address : available[0]?.address;
    if (!host) return { ok: false, error: "没有可用的局域网地址，请连接 Wi-Fi，或保存到电脑" };
    const id = randomBytes(16).toString("hex");
    const pathname = `/p/${id}.png`;
    const server = createServer((req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (req.url !== pathname) { res.writeHead(404); res.end(); return; }
      if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return; }
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length, "Content-Disposition": 'inline; filename="lessonlog-day.png"' });
      res.end(req.method === "HEAD" ? undefined : png);
    });
    server.requestTimeout = 5000;
    server.headersTimeout = 5000;
    server.keepAliveTimeout = 1000;
    const session: Session = { id, server };
    this.active = session;
    try {
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, host, resolve); });
      if (revision !== this.revision || this.active !== session) { server.closeAllConnections(); server.close(); return { ok: false, error: "分享已取消" }; }
      const binding = server.address();
      if (!binding || typeof binding === "string") throw new Error("无法取得分享端口");
      const expiresAt = Date.now() + this.ttl;
      session.timer = setTimeout(() => { void this.stop(id); }, this.ttl);
      session.timer.unref();
      return { ok: true, sessionId: id, url: `http://${host}:${binding.port}${pathname}`, expiresAt };
    } catch (error) {
      if (this.active === session) await this.closeActive();
      return { ok: false, error: `无法启动手机传图：${error instanceof Error ? error.message : "端口不可用"}` };
    }
  }

  async stop(sessionId?: string): Promise<void> {
    if (sessionId && this.active?.id !== sessionId) return;
    this.revision++;
    await this.closeActive();
  }

  private async closeActive() {
    const session = this.active;
    this.active = undefined;
    if (!session) return;
    clearTimeout(session.timer);
    session.server.closeAllConnections();
    await new Promise<void>((resolve) => session.server.close(() => resolve()));
  }
}
