/** Builds a QR reference number from the configurable QrCodeSetting. */

export interface QrFormat {
  prefix: string;
  separator: string;
  includeDocRef: boolean;
  includeProductCode: boolean;
  includeSequence: boolean;
  sequenceLength: number;
}

const clean = (s: string) => (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/**
 * Compose a code like `QR-OPN00007-JEAN30-0042`.
 * `forceSeq` guarantees a unique suffix even when the sequence segment is off
 * (used for per-piece unique codes).
 */
export function buildQrCode(
  fmt: QrFormat,
  docNo: string | null,
  productCode: string | null,
  seq: number,
  forceSeq = false,
): string {
  const parts: string[] = [];
  if (fmt.prefix) parts.push(clean(fmt.prefix));
  if (fmt.includeDocRef && docNo) parts.push(clean(docNo));
  if (fmt.includeProductCode && productCode) parts.push(clean(productCode).slice(0, 16));
  if (fmt.includeSequence || forceSeq) parts.push(String(seq).padStart(Math.max(1, fmt.sequenceLength), "0"));
  const code = parts.filter(Boolean).join(fmt.separator || "-");
  return code || `QR${seq}`;
}

/** A live sample for the settings preview (no DB hit). */
export function sampleQrCode(fmt: QrFormat): string {
  return buildQrCode(fmt, "OPN-00007", "JEAN-30", 42);
}
