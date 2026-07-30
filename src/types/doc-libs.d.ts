// Ambient declarations for pure-JS document libraries used by the Document
// Intelligence platform that don't ship their own TypeScript types.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult { text: string; numpages: number; info?: unknown; metadata?: unknown }
  function pdfParse(data: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdfParse;
}
declare module "mammoth" {
  interface MammothResult { value: string; messages: unknown[] }
  export function extractRawText(input: { buffer: Buffer } | { path: string }): Promise<MammothResult>;
  export function convertToHtml(input: { buffer: Buffer } | { path: string }): Promise<MammothResult>;
}
