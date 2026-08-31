import { describe, expect, it } from "vitest";
import { isFullyAllocated, isOverAllocated, remainderOf, sumAmounts } from "../money";

describe("sumAmounts", () => {
  it("adds string and number drafts, ignoring blanks and junk", () => {
    expect(sumAmounts(["10.50", 4.5, "", null, undefined, "abc"])).toBeCloseTo(15, 5);
  });
});

describe("remainderOf", () => {
  it("rounds to 2dp so float noise never leaks into the UI", () => {
    expect(remainderOf(100, 33.33 + 33.33 + 33.33)).toBe(0.01);
  });
  it("goes negative when over-allocated", () => {
    expect(remainderOf(50, 80)).toBe(-30);
  });
});

describe("isOverAllocated", () => {
  it("tolerates sub-penny float drift", () => {
    expect(isOverAllocated(0.3, 0.1 + 0.2)).toBe(false);
  });
  it("flags a real overspend", () => {
    expect(isOverAllocated(100, 100.05)).toBe(true);
  });
});

describe("isFullyAllocated", () => {
  it("treats float-equal totals as fully allocated", () => {
    expect(isFullyAllocated(0.3, 0.1 + 0.2)).toBe(true);
    expect(isFullyAllocated(100, 99)).toBe(false);
  });
});
