/** Shape of the POS receipt / invoice template that drives the printed bill. */
export interface ReceiptTemplate {
  title: string;
  paperSize: "58mm" | "80mm" | "A5" | "A4";
  headerNote: string;
  thankYouMessage: string;
  footerNote: string;
  showGstin: boolean;
  showCustomer: boolean;
  showHsn: boolean;
  showMrp: boolean;
  showSavings: boolean;
  showTaxBreakup: boolean;
  showItemTax: boolean;
  /** Header identity: show the branch's name & GSTIN instead of the business's common details. */
  useBranchDetails: boolean;
  /** Print the branch name line in the header. */
  showBranchName: boolean;
  /** Print a contact / toll-free number in the header. */
  showContact: boolean;
  contactNumber: string;
  /** TOKEN only — the Pre Load Weight Slip's scannable code. */
  tokenCodeType?: "qrcode" | "barcode";
  /** TOKEN only — business name font size and whether row values print bold. */
  tokenBrandFontSize?: "normal" | "large" | "xlarge";
  tokenBoldValues?: boolean;
}

export const DEFAULT_RECEIPT: ReceiptTemplate = {
  title: "Tax Invoice",
  paperSize: "80mm",
  headerNote: "",
  thankYouMessage: "Thank you! Visit again.",
  footerNote: "",
  showGstin: true,
  showCustomer: true,
  showHsn: false,
  showMrp: true,
  showSavings: true,
  showTaxBreakup: true,
  showItemTax: false,
  useBranchDetails: false,
  showBranchName: false,
  showContact: false,
  contactNumber: "",
  tokenCodeType: "qrcode",
  tokenBrandFontSize: "normal",
  tokenBoldValues: false,
};

export const PAPER_SIZES: { value: ReceiptTemplate["paperSize"]; label: string; widthMm: number }[] = [
  { value: "58mm", label: "58mm Thermal", widthMm: 54 },
  { value: "80mm", label: "80mm Thermal", widthMm: 74 },
  { value: "A5", label: "A5 Sheet", widthMm: 140 },
  { value: "A4", label: "A4 Sheet", widthMm: 190 },
];
