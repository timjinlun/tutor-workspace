import { expect, it } from "vitest";
import { drawClosingPoster } from "../src/ui/widgets/closing-poster";
import type { ClosingDayData } from "../src/core/closing-day";

const data: ClosingDayData = { date: "2026-09-12", eligible: true, lessons: 9, units: 18, monthLessons: 23, streak: 12, rows: Array.from({length:9}, () => ({title:"非常非常非常长的课程名称与学员姓名".repeat(3), start:"18:00",end:"19:00",units:2})) };
const palette = {paper:"white",ink:"black",muted:"gray",line:"gray",accent:"coral"};
function render(watermark: boolean) {
  const texts: string[] = [];
  const ctx = { fillRect() {}, beginPath() {}, ellipse() {}, fill() {}, fillText(text: string) { texts.push(text); }, measureText(text: string) { return {width:text.length * 29}; } };
  const canvas = {width:0,height:0,getContext:()=>ctx} as unknown as HTMLCanvasElement;
  drawClosingPoster(canvas,data,palette,watermark);
  return {canvas,texts};
}
it("海报保持1080×1350并按权益绘制水印", () => {
  const free = render(true); expect(free.canvas.width).toBe(1080);expect(free.canvas.height).toBe(1350);expect(free.texts).toContain("记一课");
  expect(render(false).texts).not.toContain("记一课");
});
it("长名称省略，超长列表汇总，完整场次数不缩水", () => {
  const {texts} = render(true);
  expect(texts).toContain("另有 4 节课");expect(texts).toContain("9");
  expect(texts.filter((t) => t.endsWith("…"))).toHaveLength(5);
});
