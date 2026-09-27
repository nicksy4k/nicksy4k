import { describe, expect, it } from "vitest";
import { detectCarrier, trackingLink } from "@/lib/delivery";

describe("detectCarrier", () => {
  it("matches on the courier name", () => {
    expect(detectCarrier("Royal Mail 24")?.id).toBe("royal-mail");
    expect(detectCarrier("evri")?.id).toBe("evri");
    expect(detectCarrier("Hermes")?.id).toBe("evri");
  });

  it("falls back to the tracking number shape", () => {
    expect(detectCarrier("", "1Z999AA10123456784")?.id).toBe("ups");
    expect(detectCarrier(null, "AB123456789GB")?.id).toBe("royal-mail");
    expect(detectCarrier(null, "1234567890123456")?.id).toBe("evri");
  });

  it("returns null when nothing matches", () => {
    expect(detectCarrier("Bob's Vans", "XYZ1")).toBeNull();
  });
});

describe("trackingLink", () => {
  it("needs a tracking number", () => {
    expect(trackingLink("DPD", "")).toBeNull();
    expect(trackingLink("DPD", null)).toBeNull();
  });

  it("builds a carrier link", () => {
    const link = trackingLink("DPD", "1234 5678 9012");
    expect(link?.universal).toBe(false);
    expect(link?.carrierName).toBe("DPD");
    expect(link?.url).toContain("123456789012");
  });

  it("falls back to a universal tracker", () => {
    const link = trackingLink("Bob's Vans", "ZZ99");
    expect(link?.universal).toBe(true);
    expect(link?.url).toContain("17track");
  });
});
