export interface LanAddress { address: string; label: string }
export type ShareResult = { ok: true; sessionId: string; url: string; expiresAt: number } | { ok: false; error: string };
