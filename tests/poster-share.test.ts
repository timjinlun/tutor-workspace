import { afterEach, expect, it } from "vitest";
import { PosterShare, lanAddresses } from "../electron/poster-share";
const services: PosterShare[] = [];
afterEach(async () => { await Promise.all(services.map((s) => s.stop())); services.length = 0; });
// Header + IHDR size is sufficient for transport validation; no image decoder is involved.
const bytes = Buffer.alloc(32); Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes); bytes.writeUInt32BE(1080,16); bytes.writeUInt32BE(1350,20);
const png = `data:image/png;base64,${bytes.toString("base64")}`;
it("排除回环、公开地址、IPv6和内部接口", () => {
  expect(lanAddresses({ a: [{address:"127.0.0.1",family:"IPv4",internal:true}, {address:"8.8.8.8",family:"IPv4",internal:false}, {address:"192.168.1.3",family:"IPv4",internal:false}, {address:"::1",family:"IPv6",internal:false}] })).toEqual([{address:"192.168.1.3",label:"a · 192.168.1.3"}]);
});
it("无局域网时返回可显示错误，拒绝不合规图片", async () => {
  const service = new PosterShare(() => []); services.push(service);
  expect((await service.start(png)).ok).toBe(false);
  expect((await service.start("data:text/plain;base64,aA==")).ok).toBe(false);
});
it("随机token只提供单张图片，停止后链接不可访问", async () => {
  // The production supplier is tested above; loopback keeps transport tests offline and portable.
  const addresses = [{ address: "127.0.0.1", label: "test" }];
  const service = new PosterShare(() => addresses); services.push(service);
  const started = await service.start(png);
  expect(started.ok).toBe(true);
  if (!started.ok) return;
  expect(new URL(started.url).pathname).toMatch(/^\/p\/[a-f0-9]{32}\.png$/);
  const res = await fetch(started.url);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(Buffer.from(await res.arrayBuffer())).toEqual(bytes);
  expect((await fetch(started.url + "/wrong")).status).toBe(404);
  expect((await fetch(started.url, {method:"POST"})).status).toBe(405);
  await service.stop(started.sessionId);
  await expect(fetch(started.url)).rejects.toThrow();
});
it("新会话替换旧会话，旧会话关闭请求不能关闭新会话，自动过期", async () => {
  const service = new PosterShare(() => [{address:"127.0.0.1",label:"test"}], 100); services.push(service);
  const first = await service.start(png); const second = await service.start(png);
  if (!first.ok || !second.ok) throw new Error("无法启动测试服务");
  await expect(fetch(first.url)).rejects.toThrow();
  await service.stop(first.sessionId);
  expect((await fetch(second.url)).status).toBe(200);
  await new Promise((r) => setTimeout(r, 160));
  await expect(fetch(second.url)).rejects.toThrow();
});
