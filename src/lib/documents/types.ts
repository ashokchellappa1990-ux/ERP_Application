/** Shared types for the Enterprise Knowledge & Document Intelligence platform. */

export const DOC_STATUSES = ["Draft", "Review", "Approved", "Published", "Archived", "Deleted"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

/** Workflow transitions allowed from each status (Module 13). */
export const DOC_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft: ["Review", "Archived", "Deleted"],
  Review: ["Approved", "Draft", "Archived"],
  Approved: ["Published", "Review", "Archived"],
  Published: ["Archived", "Review"],
  Archived: ["Draft", "Deleted"],
  Deleted: [],
};

/** Structured entities extracted from a document's text (Module 4 indexing). */
export interface DocEntities {
  dates: string[];
  amounts: string[];
  gstins: string[];
  emails: string[];
  invoiceNos: string[];
  poNos: string[];
  phones: string[];
  relationships: string[]; // parties/organisations mentioned
}

/** Result of extracting searchable text from an uploaded file. */
export interface ExtractResult {
  text: string;
  pages?: number;
  needsOcr: boolean; // image/scan — text must come from OCR
  engine: string; // pdf | docx | xlsx | csv | txt | rtf | image | unknown
  note?: string;
}

/** One generated summary of a document (Module 6). */
export interface DocSummary {
  kind: string;
  executive: string;
  detailed: string;
  keyPoints: string[];
  risks: string[];
  importantDates: string[];
  importantAmounts: string[];
  importantClauses: string[];
  complianceNotes: string[];
  recommendedActions: string[];
  generatedBy: "ai" | "fallback";
}

/** A comparison result between two documents/versions (Module 7). */
export interface DocDiff {
  added: string[];
  removed: string[];
  modified: { before: string; after: string }[];
  stats: { added: number; removed: number; modified: number; similarity: number };
  narrative: string;
  generatedBy: "ai" | "fallback";
}

/** OCR extraction of a scanned image (Module 3). */
export interface OcrResult {
  status: "completed" | "pending" | "failed";
  text: string;
  fields: {
    invoiceNo?: string; poNo?: string; supplier?: string; customer?: string;
    amount?: string; gst?: string; date?: string; items?: string[];
  };
  engine: string;
  note?: string;
}

export const SUPPORTED_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" }, { code: "ta", label: "Tamil" }, { code: "hi", label: "Hindi" },
  { code: "kn", label: "Kannada" }, { code: "te", label: "Telugu" }, { code: "ml", label: "Malayalam" },
  { code: "ar", label: "Arabic" }, { code: "fr", label: "French" }, { code: "de", label: "German" },
  { code: "ja", label: "Japanese" }, { code: "zh", label: "Chinese" },
];

export const DEFAULT_ALLOWED_EXTS = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "rtf", "png", "jpg", "jpeg", "tiff", "tif", "eml", "zip"];
export const IMAGE_EXTS = ["png", "jpg", "jpeg", "tiff", "tif", "webp", "gif"];
