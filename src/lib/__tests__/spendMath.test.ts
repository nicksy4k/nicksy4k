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
