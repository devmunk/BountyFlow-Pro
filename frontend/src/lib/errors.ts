/**
 * Converts wallet and Soroban SDK errors into human-readable messages.
 * Never let a raw SDK object, "[object Object]", or a "Bad union switch"
 * style message reach the UI.
 */

// Mirrors contracts/bounty/src/lib.rs `Error` enum (kept in sync manually;
// see README "Keeping contract error codes and the frontend in sync").
const BOUNTY_ERROR_MESSAGES: Record<number, string> = {
  1: "This bounty has already been created.",
  2: "This bounty contract has not been initialized yet.",
  3: "Only the bounty's creator can do that.",
  4: "Only the developer who claimed this bounty can do that.",
  5: "The reward amount must be greater than zero.",
  6: "This bounty has already been funded.",
  7: "That action isn't valid for the bounty's current status.",
  8: "This bounty is no longer open to be claimed.",
  9: "This bounty hasn't been claimed yet.",
  10: "This bounty doesn't have a submission to approve.",
  11: "You can't cancel this bounty yet — the claim window hasn't expired.",
  12: "Give the bounty a title.",
  13: "Give the bounty a description.",
  14: "Add a description of the submitted work.",
};

const FACTORY_ERROR_MESSAGES: Record<number, string> = {
  1: "The marketplace contract has already been initialized.",
  2: "The marketplace contract hasn't been initialized yet.",
  3: "Only the marketplace admin can do that.",
  4: "The reward amount must be greater than zero.",
  5: "That bounty doesn't exist.",
};

function extractContractErrorCode(message: string): number | null {
  // stellar-sdk surfaces contract panics as strings containing
  // "Error(Contract, #N)" among other diagnostic text.
  const match = message.match(/Error\(Contract, #(\d+)\)/);
  return match ? parseInt(match[1] ?? "", 10) : null;
}

export function humanizeContractError(raw: unknown): string {
  const message = messageOf(raw);
  const code = extractContractErrorCode(message);

  if (code !== null) {
    return BOUNTY_ERROR_MESSAGES[code] ?? FACTORY_ERROR_MESSAGES[code] ?? `The contract rejected this action (code ${code}).`;
  }
  if (/insufficient/i.test(message) && /balance/i.test(message)) {
    return "Insufficient XLM balance to cover this amount plus network fees.";
  }
  if (/trustline/i.test(message)) {
    return "Your account is missing a required trustline.";
  }
  if (/bad union switch/i.test(message)) {
    return "The wallet or Soroban SDK returned an unsupported transaction format. Refresh the page and try again.";
  }

  return "Something went wrong processing that transaction. Please try again.";
}

export function humanizeWalletError(raw: unknown): string {
  const message = messageOf(raw).toLowerCase();

  if (message.includes("not installed") || message.includes("not detected")) {
    return "That wallet extension is not installed. Install it and refresh the page.";
  }
  if (message.includes("rejected") || message.includes("declined") || message.includes("user cancelled") || message.includes("user canceled")) {
    return "The transaction was cancelled in your wallet.";
  }
  if (message.includes("disconnected") || message.includes("no wallet")) {
    return "Your wallet is disconnected. Connect it again to continue.";
  }
  if (message.includes("network") && (message.includes("mismatch") || message.includes("wrong"))) {
    return "Your wallet is set to the wrong network. Switch it to Stellar Testnet.";
  }
  if (message.includes("account") && message.includes("not found")) {
    return "This account doesn't exist on the network yet. Fund it first.";
  }
  return humanizeContractError(raw);
}

function messageOf(raw: unknown): string {
  if (raw instanceof Error) return raw.message;
  if (typeof raw === "string") return raw;
  try {
    const serialized = JSON.stringify(raw);
    return serialized && serialized !== "{}" ? serialized : "Unknown error";
  } catch {
    return "Unknown error";
  }
}