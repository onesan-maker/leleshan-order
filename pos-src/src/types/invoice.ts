/**
 * W14-A: Taiwan e-invoice scaffold — data model only, no third-party integration.
 * Carrier types / statuses mirror the Ministry of Finance's e-invoice system.
 */

export type InvoiceCarrierType =
  | 'mobile'    // 手機條碼（如 /XYZ.123）
  | 'business'  // 統編（B2B）
  | 'paper'     // 紙本
  | 'donate'    // 捐贈
  | 'none';     // 不開（顧客拒絕）

export type InvoiceStatus =
  | 'pending'       // 待開
  | 'issued'        // 已開（手動標記）
  | 'voided'        // 已作廢
  | 'failed'        // 開立失敗（未來串 API 用）
  | 'not_required'; // 不需要（none 類型）

export type InvoiceProvider =
  | 'manual'     // 手動開立
  | 'ecpay'      // 綠界
  | 'newebpay'   // 藍新
  | 'allpay'     // AllPay（歐付寶）
  | 'storeedc';  // 門市 EDC

export interface InvoiceInfo {
  carrierType: InvoiceCarrierType;
  carrier?: string;          // 手機條碼（/ABC.123）或統編 8 碼
  buyerName?: string;        // 抬頭（統編必填）
  buyerEmail?: string;       // 寄送 email（手機條碼 / 統編可填）
  donationCode?: string;     // 捐贈碼（如 25885）
  status: InvoiceStatus;
  invoiceNumber?: string;    // 真實發票號碼（手動或未來自動填）
  issuedAt?: string;         // ISO timestamp
  provider?: InvoiceProvider;
  note?: string;
}

/** Default value: 不開發票 */
export const DEFAULT_INVOICE: InvoiceInfo = {
  carrierType: 'none',
  status: 'not_required',
};

/** Validation helpers */
export function validateMobileCarrier(code: string): boolean {
  // /ABC.1234 format: slash + 7 chars (uppercase alphanumeric + dot)
  return /^\/[A-Z0-9+\-.]{7}$/.test(code.trim().toUpperCase());
}

export function validateBusinessId(id: string): boolean {
  return /^\d{8}$/.test(id.trim());
}

export function validateDonationCode(code: string): boolean {
  return /^\d{3,7}$/.test(code.trim());
}
