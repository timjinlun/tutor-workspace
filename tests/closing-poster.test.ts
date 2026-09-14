import { expect, it } from "vitest";
import { drawClosingPoster } from "../src/ui/widgets/closing-poster";
import type { ClosingDayData } from "../src/core/closing-day";

const data: ClosingDayData = { date: "2026-09-12", eligible: true, lessons: 9, units: 18, monthLessons: 23, streak: 12, rows: Array.from({length:9}, () => ({title:"非常非常非常长的课程名称与学员姓名".repeat(3), start:"18:00",end:"19:00",units:2})) };
const palette = {paper:"white",ink:"black",muted:"gray",line:"gray",accent:"coral"};
function render(watermark: boolean, showIncome = false, income = 1280) {
  const texts: string[] = [];
  const gradient = () => ({ addColorStop() {} });
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, strokeRect() {}, stroke() {}, createLinearGradient: gradient, createRadialGradient: gradient, fillRect() {}, beginPath() {}, ellipse() {}, fill() {}, fillText(text: string) { texts.push(text); }, measureText(text: string) { return {width:text.length * 29}; } };
  const canvas = {width:0,height:0,getContext:()=>ctx} as unknown as HTMLCanvasElement;
  drawClosingPoster(canvas,data,palette,watermark, {showIncome, income, encouragement: "今天的认真，正在变成生活的底气。"});
  return {canvas,texts};
}
it("海报保持1080×1350并按权益绘制水印", () => {
  const free = render(true); expect(free.canvas.width).toBe(1080);expect(free.canvas.height).toBe(1350);expect(free.texts).toContain("记一课");
  expect(render(false).texts).not.toContain("记一课");
});
it("默认隐藏收入和学员明细，突出课数并沿用收工励志语", () => {
  const {texts} = render(true);
  expect(texts).toContain("9 节课");
  expect(texts.join("")).not.toMatch(/¥|1,280|学员姓名|18:00/);
  expect(texts.join("")).toContain("今天的认真，正在变成生活的底气。");
});
it("选择展示收入时，明确标注授课收入并保留教学工作量", () => {
  const {texts} = render(true, true);
  expect(texts).toContain("¥1,280");
  expect(texts).toContain("今日授课收入");
  expect(texts).toContain("完成 9 节课  /  18 课时");
});
it("收入支持零元与小数，不误标为到账", () => {
  expect(render(true, true, 0).texts).toContain("¥0");
  expect(render(true, true, 1280.5).texts).toContain("¥1,280.5");
});
