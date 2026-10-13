import { beforeEach, describe, expect, it } from "vitest";
import { previewImport } from "@/core/data-import";
import { emptyState, type State } from "@/core/types";
import { useStore } from "@/store";
import webExport from "./fixtures/web-export-v4.json";

const web = () => structuredClone(webExport.data) as unknown;
const current = (): State => {
  const s = emptyState();
  s.settings = { ...s.settings, teacherName: "Tim", appearance: "dark", coinPile: [{ id: "c", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, radius: 0.08, halfHeight: 0.02 }] };
  s.students = [{ id: "old", name: "旧学员", courseIds: [], note: "", createdAt: "", archived: false, sortOrder: 0 }];
  return s;
};

describe("导入预览", () => {
  it("确认前先告诉老师会导入多少人、多少缴费、多少节课", () => {
    expect(previewImport(current().settings, web())).toMatchObject({ students: 3, payments: 2, doneLessons: 5, scheduledLessons: 1 });
  });

  it("网页版文件没有设置，保留当前称呼和外观，金币堆清空重算", () => {
    const p = previewImport(current().settings, web())!;
    expect(p.state.settings.teacherName).toBe("Tim");
    expect(p.state.settings.appearance).toBe("dark");
    expect(p.state.settings.coinPile).toEqual([]);
  });

  it("App 导出的文件自带设置，用文件里的", () => {
    const file = emptyState();
    file.settings = { ...file.settings, teacherName: "另一台电脑" };
    expect(previewImport(current().settings, file)!.state.settings.teacherName).toBe("另一台电脑");
  });

  it("不是数据文件就不给预览", () => {
    expect(previewImport(current().settings, null)).toBeNull();
    expect(previewImport(current().settings, "x")).toBeNull();
    expect(previewImport(current().settings, [])).toBeNull();
  });
});

describe("导入要确认才覆盖", () => {
  beforeEach(() => useStore.setState({ s: current(), pendingImport: null }));

  it("选完文件只出预览，不动现有数据", () => {
    expect(useStore.getState().requestImport(web())).toBe(true);
    expect(useStore.getState().pendingImport?.doneLessons).toBe(5);
    expect(useStore.getState().s.students.map((x) => x.id)).toEqual(["old"]);
  });

  it("确认后整体覆盖", () => {
    useStore.getState().requestImport(web());
    useStore.getState().confirmImport();
    expect(useStore.getState().pendingImport).toBeNull();
    expect(useStore.getState().s.students.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
    expect(useStore.getState().s.lessons).toHaveLength(6);
  });

  it("取消就什么都不变", () => {
    useStore.getState().requestImport(web());
    useStore.getState().cancelImport();
    expect(useStore.getState().pendingImport).toBeNull();
    expect(useStore.getState().s.students.map((x) => x.id)).toEqual(["old"]);
  });
});
