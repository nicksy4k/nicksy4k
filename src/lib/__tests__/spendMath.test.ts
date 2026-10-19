import { describe, it, expect } from "vitest";
import { evalSpend, scratchTotal } from "../spendMath";

describe("evalSpend", () => {
  it("adds sums", () => expect(evalSpend("18 + 14.50 + 9.99")).toBe(42.49));
  it("handles £ and precedence", () => expect(evalSpend("£2*3 + (4-1)")).toBe(9));
  it("plain number", () => expect(evalSpend("35")).toBe(35));
  it("rejects junk", () => {
    expect(evalSpend("abc")).toBeNull();
    expect(evalSpend("5+")).toBeNull();
    expect(evalSpend("4/0")).toBeNull();
    expect(evalSpend("")).toBeNull();
  });
});

describe("scratchTotal", () => {
  it("sums only ticked items", () =>
    expect(
      scratchTotal([
        { id: "a", name: "x", amount: 18, on: true },
        { id: "b", name: "y", amount: 14.5, on: false },
        { id: "c", name: "z", amount: 9.99, on: true },
      ]),
    ).toBe(27.99));
});

import { previewWithReserve } from "../safeSplit";
describe("previewWithReserve (balance 211.06, keep 73.13, put aside 78)", () => {
  const p = (a: number) => previewWithReserve(211.06, 73.13, 78, a);
  it("£20 stays in guilt-free play", () => {
    expect(p(20).playAfter).toBe(39.93);
    expect(p(20).intoReserved).toBe(0);
  });
  it("£70 dips £10.07 into put aside", () => {
    expect(p(70).intoReserved).toBe(10.07);
    expect(p(70).intoBuffer).toBe(0);
  });
  it("£150 dips £12.07 into keep safe", () => {
    expect(p(150).intoBuffer).toBe(12.07);
    expect(p(150).keepSafeAfter).toBe(61.06);
  });
});
