/** SK/CZ BBAN: four-digit bank, six-digit prefix, ten-digit account. */
export function calculateLocalIban(country: string, account: string, bank: string): string {
  if (country !== "SK" && country !== "CZ") return "";
  const parts = /^(\d{1,6}-)?(\d{1,10})$/.exec(account.replace(/\s/g, ""));
  if (!parts || !/^\d{4}$/.test(bank)) return "";
  const prefix = (parts[1]?.slice(0, -1) || "").padStart(6, "0");
  const bban = bank + prefix + parts[2].padStart(10, "0");
  const countryDigits = [...country].map(c => String(c.charCodeAt(0) - 55)).join("");
  const check = String(98n - BigInt(bban + countryDigits + "00") % 97n).padStart(2, "0");
  return country + check + bban;
}
