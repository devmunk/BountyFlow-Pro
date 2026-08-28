"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { getBountiesByCreator, getBountyAddress } from "@/lib/contracts/factory";
import { getBounty } from "@/lib/contracts/bounty";
import { BountyCard } from "@/components/BountyCard";
import { BountyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import type { Bounty } from "@/types/bounty";

export default function CreatorDashboardPage() {
  const { address, connect } = useWallet();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const ids = await getBountiesByCreator(address);
        const loaded = await Promise.all(
          ids.map(async (id) => getBounty(id, await getBountyAddress(id))),
        );
        if (!cancelled) setBounties(loaded.sort((a, b) => b.id - a.id));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your bounties");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <EmptyState title="Connect your wallet" description="Connect a Stellar wallet to see the bounties you've created." />
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
    <div>
      <h1 className="mb-1 text-xl font-bold text-bf-green">Creator Dashboard</h1>
      <p className="mb-6 text-sm text-bf-green-muted/60">
        Bounties you&apos;ve created, funded, and are tracking through to approval.
      </p>

      {error && <p className="mb-4 text-xs text-bf-red">{error}</p>}

      {loading ? (
        <BountyGridSkeleton />
      ) : bounties.length === 0 ? (
        <EmptyState title="No bounties yet" description="Create your first bounty to see it tracked here." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bounties.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>
      )}
    </div>
  );
}
