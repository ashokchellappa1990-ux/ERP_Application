// Ambient declarations for pure-JS document libraries used by the Document
// Intelligence platform that don't ship their own TypeScript types.
// (pdf-parse v2 ships its own real .d.cts types now, so no stub needed for it.)
declare module "mammoth" {
  interface MammothResult { value: string; messages: unknown[] }
  export function extractRawText(input: { buffer: Buffer } | { path: string }): Promise<MammothResult>;
  export function convertToHtml(input: { buffer: Buffer } | { path: string }): Promise<MammothResult>;
}
