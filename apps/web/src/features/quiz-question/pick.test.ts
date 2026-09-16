import { describe, expect, it } from "vitest";
import { togglePick } from "./pick";

describe("togglePick", () => {
  it("单选：点击即替换，再点同一个仍保持选中", () => {
    expect(togglePick("SINGLE", [], "B")).toEqual(["B"]);
    expect(togglePick("SINGLE", ["B"], "C")).toEqual(["C"]);
    expect(togglePick("SINGLE", ["B"], "B")).toEqual(["B"]);
  });
  it("判断：与单选一致", () => {
    expect(togglePick("JUDGE", ["A"], "B")).toEqual(["B"]);
    expect(togglePick("JUDGE", ["A"], "A")).toEqual(["A"]);
  });
  it("多选：有则去掉，无则加入并按字母排序", () => {
    expect(togglePick("MULTI", [], "C")).toEqual(["C"]);
    expect(togglePick("MULTI", ["C"], "A")).toEqual(["A", "C"]);
    expect(togglePick("MULTI", ["A", "C"], "C")).toEqual(["A"]);
  });
});
