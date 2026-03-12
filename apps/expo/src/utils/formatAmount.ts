/**
 * Format quantity for display: whole numbers without decimals (2 i.p.v. 2.00).
 */
export function formatAmount(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return "";
  const n = typeof amount === "number" ? amount : Number.parseFloat(String(amount));
  if (Number.isNaN(n)) return String(amount);
  if (Number.isInteger(n)) return String(Math.round(n));
  const s = String(n);
  const trimmed = s.replace(/\.?0+$/, "");
  return trimmed === "" ? "0" : trimmed;
}
