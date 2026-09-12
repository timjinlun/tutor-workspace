export interface FeedbackPoint { x: number; y: number }
export function feedbackTiming(monthDelta: number, hasOrigin: boolean, reduced: boolean) {
  const fly = monthDelta > 0 && hasOrigin && !reduced;
  return { flight: fly ? 500 : 0, number: fly ? 300 : 0, jarDelay: fly ? 500 : 0 };
}
