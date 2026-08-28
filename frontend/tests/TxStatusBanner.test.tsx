import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TxStatusBanner } from "@/components/TxStatusBanner";
import type { TxState } from "@/types/bounty";

describe("TxStatusBanner", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<TxStatusBanner state={{ phase: "idle" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a distinct message for each in-flight phase", () => {
    const phases: TxState[] = [
      { phase: "preparing" },
      { phase: "simulating" },
      { phase: "awaiting-wallet" },
      { phase: "submitted", hash: "abc123" },
      { phase: "confirming", hash: "abc123" },
    ];
    const seen = new Set<string>();
    for (const state of phases) {
      const { unmount, container } = render(<TxStatusBanner state={state} />);
      const text = container.textContent ?? "";
      expect(text.length).toBeGreaterThan(0);
      seen.add(text);
      unmount();
    }
    // Submission and confirmation must never render as the same string —
    // this is the "distinguish submission from confirmation" requirement.
    expect(seen.size).toBe(phases.length);
  });

  it("never displays success before an actual success phase", () => {
    render(<TxStatusBanner state={{ phase: "confirming", hash: "abc" }} />);
    expect(screen.queryByText(/^Confirmed$/)).not.toBeInTheDocument();
  });

  it("shows the confirmed state only on success", () => {
    render(<TxStatusBanner state={{ phase: "success", hash: "abc" }} />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("surfaces a human-readable error message, not a raw object", () => {
    render(<TxStatusBanner state={{ phase: "error", message: "The transaction was cancelled in your wallet." }} />);
    expect(screen.getByText("The transaction was cancelled in your wallet.")).toBeInTheDocument();
    expect(screen.queryByText(/\[object/i)).not.toBeInTheDocument();
  });

  it("renders a transaction hash link once available", () => {
    const hash = "566e74ba034a9a2b8bd6a558c82daedd7496dc28d981aecaafe4e8e87d6169c7";
    render(<TxStatusBanner state={{ phase: "submitted", hash }} />);
    expect(screen.getByText(hash)).toBeInTheDocument();
    expect(screen.queryByText("View transaction on Stellar Expert")).not.toBeInTheDocument();

    const { unmount } = render(<TxStatusBanner state={{ phase: "success", hash }} />);
    const link = screen.getByText("View transaction on Stellar Expert");
    expect(link).toHaveAttribute(`href`, `https://stellar.expert/explorer/testnet/tx/${hash}`);
    unmount();
  });
});
