/**
 * DEFAULT_LOYALTY_CONFIG — loyalty & rewards policy obeyed in real-time at billing.
 * Sales / POS read this to auto-calculate points, cashback, wallet & tier upgrades.
 */
export interface LoyaltyConfigData {
  fields: Record<string, string>;
  flags: Record<string, boolean>;
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfigData = {
  fields: {
    defaultProgram: "ONE Rewards",
    pointCalcMethod: "invoice", // invoice | product | category | brand | group
    pointsPer100: "2", // ₹100 = 2 points
    pointValue: "0.25", // 1 point = ₹0.25
    pointExpiryMonths: "12",
    minRedeem: "100", maxRedeemPct: "20",
    cashbackMethod: "percentage", cashbackPct: "5", cashbackTiming: "immediate",
    referralPoints: "100", referrerReward: "100", newCustReward: "50",
    birthdayReward: "200", anniversaryReward: "300",
  },
  flags: {
    enabled: true,
    pointBased: true, cashbackBased: true, membershipBased: true, referralBased: true, campaignBased: true,
    allowMultiple: false, carryForward: true, pointExpiry: true,
    autoUpgrade: true, autoReward: true,
    birthdayAuto: true, anniversaryAuto: true,
    posIntegration: true, mobileApp: true, customerPortal: true, aiLoyalty: true,
    approvalPointAdj: true, approvalWalletCredit: true, approvalCashback: true, approvalMembership: true, approvalGiftCard: true,
  },
};

export const ly = (n: string) => DEFAULT_LOYALTY_CONFIG.fields[n] ?? "";
export const lyFlag = (id: string) => !!DEFAULT_LOYALTY_CONFIG.flags[id];
export function loyaltyDocNo(prefix = "LP", seq = 1) {
  return [prefix, "26-27", String(Math.max(1, seq)).padStart(4, "0")].join("/");
}
