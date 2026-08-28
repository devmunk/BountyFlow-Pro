"use client";

import { useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBounties } from "@/hooks/useBounties";
import { BountyCard } from "@/components/BountyCard";
import { BountyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { BountyStatus } from "@/types/bounty";

export default function DeveloperDashboardPage() {
  const { address, connect } = useWallet();
  const { bounties, loading, error } = useBounties();

  const myBounties = useMemo(
    () => bounties.filter((b) => b.claimant === address),
    [bounties, address],
  );
  const openBounties = useMemo(
    () => bounties.filter((b) => b.status === BountyStatus.Open),
    [bounties],
  );

  if (!address) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <EmptyState title="Connect your wallet" description="Connect a Stellar wallet to claim bounties and track your work." />
        <button
          onClick={connect}
          className="rounded-md border border-bf-green-dim bg-bf-green/10 px-4 py-2 text-sm text-bf-green hover:bg-bf-green/20"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 text-xl font-bold text-bf-green">Developer Dashboard</h1>
        <p className="mb-6 text-sm text-bf-green-muted/60">
          Bounties you&apos;ve claimed, submitted, and completed.
        </p>

        {error && <p className="mb-4 text-xs text-bf-red">{error}</p>}

        {loading ? (
          <BountyGridSkeleton count={3} />
        ) : myBounties.length === 0 ? (
          <EmptyState title="No claimed bounties yet" description="Browse open bounties below and claim one to get started." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bf-green-muted/70">
          Open Bounties to Claim
        </h2>
        {loading ? (
          <BountyGridSkeleton count={3} />
        ) : openBounties.length === 0 ? (
          <EmptyState title="Nothing open right now" description="Check back soon, or create your own bounty." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
