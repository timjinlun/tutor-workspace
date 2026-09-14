import type { ClosingDayData } from "./closing-day";

const units = (value: number) => String(Number(value.toFixed(2)));

export const closingEncouragements = [
  (d: ClosingDayData) => `今天的 ${d.lessons} 节课、${units(d.units)} 课时已经完成。你交出去的耐心，也许不会立刻有回声，但会在学生往后的某次进步里留下证据。`,
  (d: ClosingDayData) => `把今天的 ${d.lessons} 节课上完，不只是划掉任务；你为 ${d.lessons} 段具体的学习时间守住了约定。`,
  (d: ClosingDayData) => `连续第 ${d.streak} 天有课。看起来只是每天准时出现，时间会把这些普通日子连成别人无法替代的专业。`,
  (d: ClosingDayData) => `本月第 ${d.monthLessons} 节课结束。真正可靠的成长，不一定热闹，但会在这样一次次完成里慢慢显形。`,
  (d: ClosingDayData) => `今天的 ${units(d.units)} 课时，没有被临时消息和琐事打断。你把最重要的事留给了学生，也留给了自己。`,
  (d: ClosingDayData) => `${d.lessons} 节课都结束了。学生未必会记得每一句解释，但会记得有人曾认真等他想明白。`,
  (d: ClosingDayData) => `第 ${d.streak} 个连续上课日。长期主义不是一直很燃，是今天该上的 ${d.lessons} 节课，你又准时完成了。`,
  (d: ClosingDayData) => `本月已经上到第 ${d.monthLessons} 节。一个独立老师的底气，往往就是这样从一节又一节课里攒出来的。`,
  (d: ClosingDayData) => `今天的 ${d.lessons} 节课已落地。那些现在看不见的改变，会在未来某次敢开口、敢尝试时回到学生身上。`,
  (d: ClosingDayData) => `${units(d.units)} 课时的专注已经交付。你不需要每天都看见结果，时间会替认真留下凭证。`,
  (d: ClosingDayData) => `连续第 ${d.streak} 天把课上完。稳定不是平淡，它是让学生知道：到了这个时间，总有人认真为他而来。`,
  (d: ClosingDayData) => `本月的第 ${d.monthLessons} 节课收尾了。比起把计划写得漂亮，把每一节真的上完更有力量。`,
  (d: ClosingDayData) => `今天完成 ${d.lessons} 节课。你正在做的不是重复劳动，而是在一个个小时里替学生搭起理解世界的台阶。`,
  (d: ClosingDayData) => `${units(d.units)} 课时之后，可以放心收工。你认真守住的课堂，终会成为学生面对难题时的一点笃定。`,
  (d: ClosingDayData) => `第 ${d.streak} 天没有断。别人看到的是课程表，你自己知道：每一节 ${d.lessons} 节课背后，都有准备、判断和陪伴。`,
  (d: ClosingDayData) => `本月 ${d.monthLessons} 节课，不是一个冷冰冰的数字；它意味着你已经在 ${d.monthLessons} 次相遇里，把专业变成了信任。`,
  (d: ClosingDayData) => `今天的 ${d.lessons} 节课结束得很安静。那些安静完成的日子，才最经得起时间的证明。`,
  (d: ClosingDayData) => `${units(d.units)} 课时，${d.lessons} 次认真抵达。你不必急着证明什么，持续把课上好，本身就在回答。`,
  (d: ClosingDayData) => `连续第 ${d.streak} 天有课。你今天做的事很具体：让几个孩子在规定的时间里，多理解了一点。`,
  (d: ClosingDayData) => `本月第 ${d.monthLessons} 节课已完成。真正属于你的工作节奏，不靠催促，而靠今天又如期收工。`,
] as const;

export function closingEncouragement(data: ClosingDayData, random = Math.random): string {
  const index = Math.min(closingEncouragements.length - 1, Math.floor(random() * closingEncouragements.length));
  return closingEncouragements[index]!(data);
}
