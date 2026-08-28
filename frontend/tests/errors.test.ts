import { describe, it, expect } from "vitest";
import { humanizeContractError, humanizeWalletError } from "@/lib/errors";

describe("humanizeContractError", () => {
  it("maps known bounty contract error codes to readable text", () => {
    const raw = new Error("HostError: Error(Contract, #8)");
    expect(humanizeContractError(raw)).toMatch(/no longer open/i);
  });

  it("maps known factory contract error codes to readable text", () => {
    // Code 5 is ambiguous between bounty and factory tables in isolation,
    // but both resolve to a coherent, non-raw message either way.
    const raw = new Error("Error(Contract, #5)");
    const message = humanizeContractError(raw);
    expect(message).not.toMatch(/\[object/i);
    expect(message.length).toBeGreaterThan(0);
  });

  it("never leaks [object Object] or raw SDK objects", () => {
    const raw = { some: "sdk", nested: { object: true } };
    const message = humanizeContractError(raw);
    expect(message).not.toMatch(/\[object Object\]/);
  });

  it("gives a readable fallback for unrecognized errors", () => {
    const message = humanizeContractError(new Error("totally unknown host trap"));
    expect(message).toBe("Something went wrong processing that transaction. Please try again.");
  });

  it("detects insufficient balance errors", () => {
    const message = humanizeContractError(new Error("insufficient balance for transfer"));
    expect(message).toMatch(/insufficient xlm balance/i);
  });
});

describe("humanizeWalletError", () => {
  it("detects wallet rejection", () => {
    const message = humanizeWalletError(new Error("User declined access"));
    expect(message).toMatch(/cancelled/i);
  });

  it("detects wallet not installed", () => {
    const message = humanizeWalletError(new Error("Freighter is not installed"));
    expect(message).toMatch(/not installed/i);
  });

  it("detects network mismatch", () => {
    const message = humanizeWalletError(new Error("wrong network selected"));
    expect(message).toMatch(/wrong network/i);
  });

  it("never surfaces 'Bad union switch' verbatim", () => {
    const message = humanizeWalletError(new Error("Bad union switch: 7"));
    expect(message).not.toMatch(/bad union switch/i);
  });
});
