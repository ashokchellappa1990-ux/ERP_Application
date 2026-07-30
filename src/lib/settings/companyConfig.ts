/**
 * Company-level setup that documents read. The GST flag here (from Business Setup)
 * controls whether Tax & HSN fields appear on sales/purchase documents.
 * Mutable singleton so the Settings screen and the document forms stay in sync
 * within a session.
 */
export interface CompanyConfig {
  gstEnabled: boolean;
  compositionScheme: boolean;
  showHsn: boolean;
  hsnMandatory: boolean;
}

export const DEFAULT_COMPANY_CONFIG: CompanyConfig = {
  gstEnabled: true,
  compositionScheme: false,
  showHsn: true,
  hsnMandatory: false,
};

export const companyFlag = (id: keyof CompanyConfig) => !!DEFAULT_COMPANY_CONFIG[id];
export function setCompanyFlag(id: keyof CompanyConfig, v: boolean) { DEFAULT_COMPANY_CONFIG[id] = v; }
