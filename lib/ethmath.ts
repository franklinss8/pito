/** Exact ETH <-> wei helpers with BigInt (no floating point). */
export function ethToWei(str: string): bigint | null {
  const s = String(str).trim();
  if (!/^\d+(\.\d{1,18})?$/.test(s)) return null;
  const [i, f = ""] = s.split(".");
  return BigInt(i) * 10n ** 18n + BigInt((f + "0".repeat(18)).slice(0, 18));
}

export function fmtEth(wei: bigint): string {
  const neg = wei < 0n;
  if (neg) wei = -wei;
  const i = wei / 10n ** 18n;
  const f = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + i.toString() + (f ? "." + f : "");
}

export const PLATFORM_FEE_BPS = 30;
