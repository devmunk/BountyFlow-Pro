import { describe, it, expect } from "vitest";
import { xlmToStroops, stroopsToXlm, formatXlm, validateRewardInput, shortenAddress } from "@/lib/format";

describe("xlmToStroops / stroopsToXlm round-trip", () => {
  it("converts whole XLM amounts", () => {
    expect(xlmToStroops("10")).toBe(100_000_000n);
    expect(stroopsToXlm(100_000_000n)).toBe("10");
  });

  it("converts fractional XLM amounts precisely", () => {
    expect(xlmToStroops("12.5")).toBe(125_000_000n);
    expect(xlmToStroops("0.0000001")).toBe(1n);
    expect(stroopsToXlm(1n)).toBe("0.0000001");
  });

  it("never produces scientific notation for large amounts", () => {
    const formatted = stroopsToXlm(1_000_000_000_000n);
    expect(formatted).not.toMatch(/e/i);
    expect(formatted).toBe("100000");
  });

  it("rejects malformed input", () => {
    expect(() => xlmToStroops("abc")).toThrow();
    expect(() => xlmToStroops("1.23456789")).toThrow(); // too many decimals
    expect(() => xlmToStroops("-5")).toThrow();
  });
});

describe("formatXlm", () => {
  it("formats with thousands separators and fixed decimals", () => {
    expect(formatXlm(1_234_567_890_0000000n, 2)).toBe("1,234,567,890.00");
  });

  it("supports zero decimals", () => {
    expect(formatXlm(50_0000000n, 0)).toBe("50");
  });
});

describe("validateRewardInput", () => {
  it("rejects empty input", () => {
    expect(validateRewardInput("").valid).toBe(false);
  });

  it("rejects zero and negative amounts", () => {
    expect(validateRewardInput("0").valid).toBe(false);
  });

  it("accepts a valid positive amount", () => {
    expect(validateRewardInput("42.5").valid).toBe(true);
  });

  it("rejects amounts exceeding available balance", () => {
    const result = validateRewardInput("100", 50_0000000n);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/insufficient/i);
  });

  it("accepts amounts within available balance", () => {
    const result = validateRewardInput("10", 50_0000000n);
    expect(result.valid).toBe(true);
  });
});

describe("shortenAddress", () => {
  it("shortens long addresses", () => {
    const addr = "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP";
    expect(shortenAddress(addr)).toBe("GABC...MNOP");
  });

  it("leaves short strings untouched", () => {
    expect(shortenAddress("GABC")).toBe("GABC");
  });
});
