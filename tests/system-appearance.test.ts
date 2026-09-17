import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  color: vi.fn(() => "0078d4ff"),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("electron", () => ({
  systemPreferences: Object.assign(new EventEmitter(), {
    getAccentColor: native.color,
    subscribeNotification: native.subscribe,
    unsubscribeNotification: native.unsubscribe,
  }),
}));
import { systemPreferences } from "electron";
import { systemAccent, watchSystemAccent } from "../electron/system-appearance";

beforeEach(() => {
  vi.resetAllMocks();
  native.color.mockReturnValue("0078d4ff");
  systemPreferences.removeAllListeners();
});

describe("desktop system accent", () => {
  it.each(["win32", "darwin"] as const)("reads %s system color without the alpha channel", platform => {
    expect(systemAccent(platform)).toBe("#0078d4");
  });

  it("keeps the default accent when the OS has no usable color", () => {
    expect(systemAccent("linux")).toBeNull();
    native.color.mockImplementationOnce(() => { throw new Error("unavailable"); });
    expect(systemAccent("win32")).toBeNull();
    native.color.mockReturnValueOnce("invalid");
    expect(systemAccent("win32")).toBeNull();
  });

  it("updates the Windows accent live and stops delivering after cleanup", () => {
    const changes: string[] = [];
    const stop = watchSystemAccent(hex => changes.push(hex), "win32");
    native.color.mockReturnValue("ff8800ff");
    systemPreferences.emit("accent-color-changed", {}, "ff8800ff");
    expect(changes).toEqual(["#ff8800"]);
    stop();
    systemPreferences.emit("accent-color-changed", {}, "ff8800ff");
    expect(changes).toEqual(["#ff8800"]);
  });

  it("preserves the macOS notification subscription and releases it", () => {
    let changed: () => void = () => {};
    native.subscribe.mockImplementationOnce((_name, callback) => { changed = callback; return 7; });
    const listener = vi.fn();
    const stop = watchSystemAccent(listener, "darwin");
    changed();
    expect(listener).toHaveBeenCalledWith("#0078d4");
    stop();
    expect(native.unsubscribe).toHaveBeenCalledWith(7);
  });
});
