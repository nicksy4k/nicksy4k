import { describe, expect, it } from "vitest";

import {
  expiryFromDays,
  expiryLabel,
  generateShareToken,
  isShareUsable,
  isValidTokenShape,
  shareState,
  shareUrl,
} from "../loanShare";

const NOW = new Date("2026-09-01T12:00:00Z");

describe("shareState", () => {
  it("treats a fresh link with no expiry as active", () => {
    expect(shareState({ token: "abc" }, NOW)).toBe("active");
    expect(isShareUsable({ token: "abc" }, NOW)).toBe(true);
  });

  it("reports revoked links first", () => {
    expect(
      shareState(
        { token: "abc", revoked_at: "2026-08-20T00:00:00Z", expires_at: "2026-12-01T00:00:00Z" },
        NOW,
      ),
    ).toBe("revoked");
  });

  it("reports expired links", () => {
    expect(shareState({ token: "abc", expires_at: "2026-08-31T00:00:00Z" }, NOW)).toBe("expired");
    expect(isShareUsable({ token: "abc", expires_at: "2026-08-31T00:00:00Z" }, NOW)).toBe(false);
  });

  it("keeps a future expiry active", () => {
    expect(shareState({ token: "abc", expires_at: "2026-09-30T00:00:00Z" }, NOW)).toBe("active");
  });
});

describe("expiry helpers", () => {
  it("returns null for never-expiring links", () => {
    expect(expiryFromDays(0, NOW)).toBeNull();
  });

  it("adds whole days", () => {
    expect(expiryFromDays(7, NOW)).toBe("2026-09-08T12:00:00.000Z");
  });

  it("labels a missing expiry", () => {
    expect(expiryLabel({ token: "abc" })).toBe("Never expires");
    expect(expiryLabel({ token: "abc", expires_at: "2026-09-08T12:00:00Z" })).toContain("Expires");
  });
});

describe("tokens and urls", () => {
  it("builds a url without doubling slashes", () => {
    expect(shareUrl("https://example.com/", "tok")).toBe("https://example.com/s/tok");
    expect(shareUrl("https://example.com", "tok")).toBe("https://example.com/s/tok");
  });

  it("generates unique url-safe tokens", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
    expect(isValidTokenShape(a)).toBe(true);
  });

  it("rejects malformed tokens", () => {
    expect(isValidTokenShape("short")).toBe(false);
    expect(isValidTokenShape("../../etc/passwd")).toBe(false);
  });
});
