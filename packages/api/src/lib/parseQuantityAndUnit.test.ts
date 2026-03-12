import { describe, it, expect } from "vitest";
import { parseQuantityAndUnit } from "./parseQuantityAndUnit";

describe("parseQuantityAndUnit", () => {
  it("parses '2 kratten bier' as quantity 2, unit crate", () => {
    const r = parseQuantityAndUnit("2 kratten bier");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("crate");
    expect(r.namePart).toBe("bier");
  });

  it("parses '2 flessen siracha saus' as quantity 2, unit bottle", () => {
    const r = parseQuantityAndUnit("2 flessen siracha saus");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("bottle");
    expect(r.namePart).toBe("siracha saus");
  });

  it("parses '2 kg Kipfilet' as quantity 2, unit kg", () => {
    const r = parseQuantityAndUnit("2 kg Kipfilet");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("kg");
    expect(r.namePart).toBe("Kipfilet");
  });

  it("parses '2 stuks ui' as quantity 2, unit piece", () => {
    const r = parseQuantityAndUnit("2 stuks ui");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("piece");
    expect(r.namePart).toBe("ui");
  });

  it("parses '1 blik tomaten' as quantity 1, unit can", () => {
    const r = parseQuantityAndUnit("1 blik tomaten");
    expect(r.quantity).toBe(1);
    expect(r.unit).toBe("can");
    expect(r.namePart).toBe("tomaten");
  });

  it("parses '200g bloem' as quantity 200, unit g", () => {
    const r = parseQuantityAndUnit("200g bloem");
    expect(r.quantity).toBe(200);
    expect(r.unit).toBe("g");
    expect(r.namePart).toBe("bloem");
  });

  it("parses '2 bottles soy sauce' as quantity 2, unit bottle", () => {
    const r = parseQuantityAndUnit("2 bottles soy sauce");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("bottle");
    expect(r.namePart).toBe("soy sauce");
  });

  it("parses '1 crate beer' as quantity 1, unit crate", () => {
    const r = parseQuantityAndUnit("1 crate beer");
    expect(r.quantity).toBe(1);
    expect(r.unit).toBe("crate");
    expect(r.namePart).toBe("beer");
  });

  it("parses '2 flessen cola' as quantity 2, unit bottle", () => {
    const r = parseQuantityAndUnit("2 flessen cola");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("bottle");
    expect(r.namePart).toBe("cola");
  });

  it("parses legacy '2 st ui' as quantity 2, unit piece", () => {
    const r = parseQuantityAndUnit("2 st ui");
    expect(r.quantity).toBe(2);
    expect(r.unit).toBe("piece");
    expect(r.namePart).toBe("ui");
  });

  it("parses legacy '1 pak melk' as quantity 1, unit package", () => {
    const r = parseQuantityAndUnit("1 pak melk");
    expect(r.quantity).toBe(1);
    expect(r.unit).toBe("package");
    expect(r.namePart).toBe("melk");
  });

  it("parses '1 fles water' as quantity 1, unit bottle", () => {
    const r = parseQuantityAndUnit("1 fles water");
    expect(r.quantity).toBe(1);
    expect(r.unit).toBe("bottle");
    expect(r.namePart).toBe("water");
  });
});
