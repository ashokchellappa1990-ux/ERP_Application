/** Decide which QR codes to print for a (partial) print run. Shared by Opening
 * Stock and GRN. For "unique" mode it prints the next un-printed window and
 * wraps for re-prints; for "shared" mode it repeats the single code. */
export interface QrMappingRow { id: number; code: string; seq: number }

export function selectPrintCodes(mappings: QrMappingRow[], mode: string, printedQty: number, requested: number) {
  const n = Math.max(1, Math.min(5000, Math.round(requested) || 0));
  const codes: string[] = [];
  const byId = new Map<number, number>();
  if (mode === "unique" && mappings.length) {
    const total = mappings.length;
    const start = printedQty % total;
    for (let i = 0; i < n; i++) {
      const m = mappings[(start + i) % total];
      codes.push(m.code);
      byId.set(m.id, (byId.get(m.id) ?? 0) + 1);
    }
  } else if (mappings.length) {
    const m = mappings[0];
    for (let i = 0; i < n; i++) codes.push(m.code);
    byId.set(m.id, n);
  }
  return { codes, touched: Array.from(byId, ([id, by]) => ({ id, by })), count: n };
}
