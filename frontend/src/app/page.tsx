"use client";

import Link from "next/link";
import { useActivity } from "@/components/ActivityProvider";
import { BountyCard } from "@/components/BountyCard";
import { BountyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ActivityFeed } from "@/components/ActivityFeed";
import { BountyStatus } from "@/types/bounty";

export default function HomePage() {
  const { bounties, events, loading, error } = useActivity();

  const openBounties = bounties.filter((b) => b.status === BountyStatus.Open);

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-bf-border bg-gradient-to-br from-bf-panel to-bf-black-soft p-8 sm:p-12">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-bf-green-dim">
          Stellar Soroban · Testnet
        </p>
        <h1 className="max-w-2xl text-3xl font-bold text-bf-green sm:text-4xl">
          A decentralized bounty marketplace with real, on-chain escrow.
        </h1>
        <p className="mt-4 max-w-xl text-sm text-bf-green-muted/70">
          Post a bounty, escrow the XLM reward on-chain, and pay out automatically
          the moment you approve the submitted work. No custodians, no IOUs.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="rounded-md bg-bf-green px-5 py-2.5 text-sm font-semibold text-bf-black transition hover:bg-bf-green-muted"
          >
            Create a Bounty
          </Link>
          <Link
            href="/dashboard/developer"
            className="rounded-md border border-bf-border px-5 py-2.5 text-sm font-semibold text-bf-green-muted transition hover:border-bf-green-dim"
          >
            Browse as Developer
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bf-green-muted/70">
              Open Bounties ({openBounties.length})
            </h2>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-bf-red/40 bg-bf-red/10 px-4 py-3 text-xs text-bf-red">
              {error}
            </div>
          )}

          {loading ? (
            <BountyGridSkeleton />
          ) : openBounties.length === 0 ? (
            <EmptyState
              title="No open bounties yet"
              description="Be the first to post a bounty and fund its escrow on-chain."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {openBounties.map((bounty) => (
                <BountyCard key={bounty.id} bounty={bounty} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bf-green-muted/70">
            Live Activity
          </h2>
          <div className="rounded-lg border border-bf-border bg-bf-panel/40 p-3">
            <ActivityFeed events={events} bounties={bounties} />
          </div>
        </div>
      </section>
    </div>
  );
}
