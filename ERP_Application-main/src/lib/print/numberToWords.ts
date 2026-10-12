const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigits(n: number): string {
  let s = "";
  if (n >= 100) { s += `${ONES[Math.floor(n / 100)]} Hundred `; n %= 100; }
  if (n >= 20) { s += `${TENS[Math.floor(n / 10)]} `; n %= 10; }
  if (n > 0) s += `${ONES[n]} `;
  return s.trim();
}

/** Indian numbering (Crore/Lakh/Thousand) amount-in-words, e.g. 5920 → "Five Thousand Nine Hundred Twenty". */
function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  const rest = n;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ").trim();
}

/** "Rupees Five Thousand Nine Hundred Twenty Only" — paise included when non-zero. */
export function amountInWords(amount: number, currency = "Rupees"): string {
  const value = Math.max(0, Number(amount) || 0);
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);
  let out = `${currency} ${integerToWords(rupees)}`;
  if (paise > 0) out += ` and ${integerToWords(paise)} Paise`;
  return `${out} Only`;
}
