import { describe, it, expect } from "vitest";
import { normalizeUnitToCanonical } from "./normalizeUnit";

describe("normalizeUnitToCanonical", () => {
  it("maps legacy st to piece", () => {
    expect(normalizeUnitToCanonical("st")).toBe("piece");
  });

  it("maps legacy blik to can", () => {
    expect(normalizeUnitToCanonical("blik")).toBe("can");
  });

  it("maps legacy pak to package", () => {
    expect(normalizeUnitToCanonical("pak")).toBe("package");
  });

  it("maps legacy fles/flessen to bottle", () => {
    expect(normalizeUnitToCanonical("fles")).toBe("bottle");
    expect(normalizeUnitToCanonical("flessen")).toBe("bottle");
  });

  it("maps legacy krat/kratten to crate", () => {
    expect(normalizeUnitToCanonical("krat")).toBe("crate");
    expect(normalizeUnitToCanonical("kratten")).toBe("crate");
  });

  it("leaves canonical units unchanged", () => {
    expect(normalizeUnitToCanonical("piece")).toBe("piece");
    expect(normalizeUnitToCanonical("bottle")).toBe("bottle");
    expect(normalizeUnitToCanonical("package")).toBe("package");
  });

  it("returns same canonical for merge: pak and package", () => {
    expect(normalizeUnitToCanonical("pak")).toBe(normalizeUnitToCanonical("package"));
  });

  it("returns null for empty/null", () => {
    expect(normalizeUnitToCanonical(null)).toBe(null);
    expect(normalizeUnitToCanonical("")).toBe(null);
    expect(normalizeUnitToCanonical(undefined)).toBe(null);
  });

  it("maps unknown units to other", () => {
    expect(normalizeUnitToCanonical("unknown")).toBe("other");
  });
});
