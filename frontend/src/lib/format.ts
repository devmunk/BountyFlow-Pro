/**
 * Amount handling: the UI only ever shows/accepts normal XLM values
 * ("12.5", "100"). Stroops (1 XLM = 10_000_000 stroops) are an on-chain
 * implementation detail and never leak into user-facing text.
 */

export const STROOPS_PER_XLM = 10_000_000n;

/** Parses a user-typed XLM string into an integer stroop amount (bigint). */
export function xlmToStroops(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new Error("Enter a valid amount, e.g. 12.5");
  }
  const [whole = "0", frac = ""] = trimmed.split(".");
  const paddedFrac = frac.padEnd(7, "0");
  const stroops = BigInt(whole) * STROOPS_PER_XLM + BigInt(paddedFrac || "0");
  return stroops;
}

/** Converts a stroop amount (bigint | string | number) into a plain XLM string. */
export function stroopsToXlm(stroops: bigint | string | number): string {
  const value = typeof stroops === "bigint" ? stroops : BigInt(stroops);
  const whole = value / STROOPS_PER_XLM;
  const frac = value % STROOPS_PER_XLM;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

/** Formats a stroop amount for display with a fixed number of decimals, no scientific notation. */
export function formatXlm(stroops: bigint | string | number, decimals = 2): string {
  const xlm = stroopsToXlm(stroops);
  const [whole = "0", frac = ""] = xlm.split(".");
  const wholeFormatted = Number(whole).toLocaleString("en-US");
  if (decimals === 0) return wholeFormatted;
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  return `${wholeFormatted}.${fracPadded}`;
}

export interface RewardValidationResult {
  valid: boolean;
  error?: string;
}

/** UX-only validation. The contract re-validates reward > 0 on-chain regardless. */
export function validateRewardInput(
  input: string,
  availableBalanceStroops?: bigint,
): RewardValidationResult {
  if (!input.trim()) {
    return { valid: false, error: "Enter a reward amount" };
  }
  let stroops: bigint;
  try {
    stroops = xlmToStroops(input);
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Invalid amount" };
  }
  if (stroops <= 0n) {
    return { valid: false, error: "Reward must be greater than 0" };
  }
  if (availableBalanceStroops !== undefined && stroops > availableBalanceStroops) {
    return { valid: false, error: `Insufficient balance (${stroopsToXlm(availableBalanceStroops)} XLM available)` };
  }
  return { valid: true };
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
