import { describe, it, expect } from "vitest";
import { formatAmount } from "./formatAmount";

describe("formatAmount", () => {
  it("formats integers without decimals: 2.00 -> 2", () => {
    expect(formatAmount(2)).toBe("2");
    expect(formatAmount(2.0)).toBe("2");
    expect(formatAmount("2.00")).toBe("2");
  });

  it("formats compact decimals: 1.50 -> 1.5", () => {
    expect(formatAmount(1.5)).toBe("1.5");
    expect(formatAmount("1.50")).toBe("1.5");
  });

  it("handles null/undefined/empty", () => {
    expect(formatAmount(null)).toBe("");
    expect(formatAmount(undefined)).toBe("");
    expect(formatAmount("")).toBe("");
  });

  it("handles numeric strings", () => {
    expect(formatAmount("200")).toBe("200");
    expect(formatAmount("0.25")).toBe("0.25");
  });
});
