import { describe, it, expect } from "vitest";
import {
  areSimilar,
  buildFrequency,
  editDistance,
  findDuplicateGroups,
  normalise,
} from "@/lib/suggestionSimilarity";

describe("suggestionSimilarity", () => {
  it("normalises case, whitespace, punctuation and plurals", () => {
    expect(normalise("  Monster  ", "item")).toBe("monster");
    expect(normalise("Cans", "item")).toBe("can");
    expect(normalise("Energies", "item")).toBe("energy");
    expect(normalise("Tesco Ltd.", "retailer")).toBe("tesco");
    expect(normalise("The Sainsbury's", "retailer")).toBe("sainsbury");
  });

  it("computes edit distance including transposition", () => {
    expect(editDistance("tesco", "tescos")).toBe(1);
    expect(editDistance("form", "from")).toBe(1);
    expect(editDistance("abc", "xyz")).toBe(3);
  });

  it("flags exact, substring and close-typo pairs as similar", () => {
    expect(areSimilar("monster", "monster energy")).toBe(true);
    expect(areSimilar("tesco", "tescos")).toBe(true);
    expect(areSimilar("sainsbury", "sainsburys")).toBe(true);
    expect(areSimilar("aldi", "lidl")).toBe(false);
    expect(areSimilar("milk", "bread")).toBe(false);
  });

  it("does not group unrelated names", () => {
    const groups = findDuplicateGroups(["Aldi", "Lidl", "Boots"], "retailer");
    expect(groups).toEqual([]);
  });

  it("groups plural, substring and typo duplicates and orders by frequency", () => {
    const catalog = ["Monster", "Monster Energy", "Tesco", "Tescos", "Aldi"];
    const freq = buildFrequency(
      ["Monster", "Monster", "Monster Energy", "Tesco", "Tesco", "Tesco", "Tescos", "Aldi"],
      "item",
    );
    const groups = findDuplicateGroups(catalog, "item", freq);
    expect(groups).toHaveLength(2);
    const flat = groups.map((g) => [...g.names].sort());
    expect(flat).toContainEqual(["Monster", "Monster Energy"]);
    expect(flat).toContainEqual(["Tesco", "Tescos"]);
    // Master (first) should be the most-frequent spelling.
    const tescoGroup = groups.find((g) => g.names.includes("Tesco"))!;
    expect(tescoGroup.names[0]).toBe("Tesco");
  });
});
