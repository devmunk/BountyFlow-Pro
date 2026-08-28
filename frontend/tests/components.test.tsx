import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";
import { BountyCard } from "@/components/BountyCard";
import { BountyStatus, type Bounty } from "@/types/bounty";

function makeBounty(overrides: Partial<Bounty> = {}): Bounty {
  return {
    id: 1,
    contractAddress: "CABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD",
    creator: "GCREATOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    title: "Fix login bug",
    description: "The login form crashes on submit for empty passwords.",
    rewardStroops: 50_0000000n,
    status: BountyStatus.Open,
    claimant: null,
    submission: null,
    claimTimeoutSecs: 0,
    createdAt: 0,
    fundedAt: 0,
    claimedAt: 0,
    ...overrides,
  };
}

describe("StatusBadge", () => {
  it("renders the correct label for each status", () => {
    const cases: Array<[BountyStatus, string]> = [
      [BountyStatus.Created, "Awaiting Funding"],
      [BountyStatus.Open, "Open"],
      [BountyStatus.Claimed, "Claimed"],
      [BountyStatus.Submitted, "In Review"],
      [BountyStatus.Released, "Completed"],
      [BountyStatus.Refunded, "Refunded"],
    ];
    for (const [status, label] of cases) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("BountyCard", () => {
  it("renders bounty title, formatted reward, and status", () => {
    render(<BountyCard bounty={makeBounty()} />);
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.getByText("50.00 XLM")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("links to the bounty detail page", () => {
    render(<BountyCard bounty={makeBounty({ id: 7 })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/bounty/7");
  });

  it("shows a shortened creator address", () => {
    render(<BountyCard bounty={makeBounty()} />);
    expect(screen.getByText(/GCRE\.\.\./)).toBeInTheDocument();
  });
});
