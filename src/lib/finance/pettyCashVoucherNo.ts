/** Petty-cash voucher number builder — prefix + optional FY/year + optional month
 * + running sequence, with the sequence reset monthly / per financial year / never. */
export interface VoucherNumCfg {
  voucherPrefix: string; voucherPadding: number; voucherSeparator: string;
  voucherIncludeYear: boolean; voucherIncludeMonth: boolean; voucherYearFormat: string;
  voucherResetFrequency: string; voucherSeq: number; voucherSeqPeriod: string | null;
}

function periodKey(resetFrequency: string, d: Date): string {
  const y = d.getFullYear(); const m = d.getMonth(); // 0-based
  switch (resetFrequency) {
    case "monthly": return `${y}-${String(m + 1).padStart(2, "0")}`;
    case "financial_year": return `FY${m >= 3 ? y : y - 1}`; // FY starts April
    default: return "ALL";
  }
}
function yearToken(fmt: string, d: Date): string {
  const y = d.getFullYear(); const fyStart = d.getMonth() >= 3 ? y : y - 1; const fyEnd = fyStart + 1;
  switch (fmt) {
    case "fy_full": return `${fyStart}-${fyEnd}`;
    case "cal_full": return `${y}`;
    case "cal_short": return String(y).slice(-2);
    case "fy_short": default: return `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
  }
}

/** Returns the next voucher number plus the seq + period to persist back. */
export function buildVoucherNo(cfg: VoucherNumCfg, now: Date): { voucherNo: string; seq: number; period: string } {
  const period = periodKey(cfg.voucherResetFrequency, now);
  const seq = (cfg.voucherSeqPeriod === period ? cfg.voucherSeq : 0) + 1;
  const sep = cfg.voucherSeparator ?? "-";
  const parts: string[] = [cfg.voucherPrefix];
  if (cfg.voucherIncludeYear) parts.push(yearToken(cfg.voucherYearFormat || "fy_short", now));
  if (cfg.voucherIncludeMonth) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  parts.push(String(seq).padStart(Math.max(1, cfg.voucherPadding || 1), "0"));
  return { voucherNo: parts.join(sep), seq, period };
}
