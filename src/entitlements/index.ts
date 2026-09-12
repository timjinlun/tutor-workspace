/**
 * 免费版 / 商业版的唯一边界。
 * UI 只问 can() / limit() / check()，从不自己写 `if (isPro)`。
 * 要挪一个功能的等级，改这个文件，别处不动。
 */

export type Tier = "free" | "pro";

export type Feature =
  | "recruit.kanban"
  | "recruit.reminders"
  | "reports.customRange"
  | "reports.pdf"
  | "library.files"
  | "referral.autoReward"
  | "scorecard.templates"
  | "scorecard.noWatermark";

export type Limit = "teachers" | "leads";

const FEATURE_TIER: Record<Feature, Tier> = {
  "recruit.kanban": "pro",
  "recruit.reminders": "pro",
  "reports.customRange": "pro",
  "reports.pdf": "pro",
  "library.files": "pro",
  "referral.autoReward": "pro",
  "scorecard.templates": "pro",
  "scorecard.noWatermark": "pro",
};

const LIMITS: Record<Tier, Record<Limit, number>> = {
  free: { teachers: 5, leads: 50 },
  pro: { teachers: Infinity, leads: Infinity },
};

const RANK: Record<Tier, number> = { free: 0, pro: 1 };

export interface Entitlements {
  tier: Tier;
  can(feature: Feature): boolean;
  limit(key: Limit): number;
  /** 再加一个会不会超限 */
  check(key: Limit, currentCount: number): { ok: true } | { ok: false; limit: number; reason: string };
}

export function createEntitlements(tier: Tier): Entitlements {
  return {
    tier,
    can: (f) => RANK[tier] >= RANK[FEATURE_TIER[f]],
    limit: (k) => LIMITS[tier][k],
    check(k, count) {
      const lim = LIMITS[tier][k];
      if (count + 1 <= lim) return { ok: true };
      return { ok: false, limit: lim, reason: UPGRADE_COPY[k](lim) };
    },
  };
}

const UPGRADE_COPY: Record<Limit, (lim: number) => string> = {
  teachers: (lim) => `免费版最多 ${lim} 位老师。多老师团队请使用商业版。`,
  leads: (lim) => `免费版最多记录 ${lim} 条潜在学员。`,
};
