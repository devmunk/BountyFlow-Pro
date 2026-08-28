"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useTransaction } from "@/hooks/useTransaction";
import { getBountyAddress } from "@/lib/contracts/factory";
import { getBounty, claimBounty, submitWork, approveBounty, cancelBounty } from "@/lib/contracts/bounty";
import { formatXlm, shortenAddress } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { TxStatusBanner } from "@/components/TxStatusBanner";
import { BountyStatus, type Bounty, type TxState } from "@/types/bounty";

export default function BountyDetailPage() {
  const params = useParams<{ id: string }>();
  const bountyId = Number(params.id);
  const { address, connect } = useWallet();

  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submitDescription, setSubmitDescription] = useState("");
  const [submitLink, setSubmitLink] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const contractAddress = await getBountyAddress(bountyId);
      const data = await getBounty(bountyId, contractAddress);
      setBounty(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bounty not found");
    } finally {
      setLoading(false);
    }
  }

  // Re-fetching on-chain state on mount (rather than trusting any locally
  // cached status) is exactly what lets this page recover correctly if the
  // user reloads mid-transaction: whatever the contract actually recorded
  // is what renders, and stale action buttons for an already-changed status
  // simply won't appear.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId]);

  const claimTx = useTransaction((onState) => {
    if (!address || !bounty) throw new Error("Connect your wallet first");
    return claimBounty(bounty.contractAddress, address, onState);
  });
  const submitTx = useTransaction((onState) => {
    if (!address || !bounty) throw new Error("Connect your wallet first");
    return submitWork(bounty.contractAddress, address, submitDescription.trim(), submitLink.trim(), onState);
  });
  const approveTx = useTransaction((onState) => {
    if (!address || !bounty) throw new Error("Connect your wallet first");
    return approveBounty(bounty.contractAddress, address, onState);
  });
  const cancelTx = useTransaction((onState) => {
    if (!address || !bounty) throw new Error("Connect your wallet first");
    return cancelBounty(bounty.contractAddress, address, onState);
  });

  async function afterAction(run: () => Promise<unknown>) {
    const result = await run();
    if (result) await load();
  }

  if (loading) {
    return <div className="animate-pulse text-sm text-bf-green-muted/50">Loading bounty...</div>;
  }
  if (error || !bounty) {
    return <div className="rounded-md border border-bf-red/40 bg-bf-red/10 px-4 py-3 text-sm text-bf-red">{error ?? "Bounty not found"}</div>;
  }

  const isCreator = address === bounty.creator;
  const isClaimant = address !== null && address === bounty.claimant;
  const now = Math.floor(Date.now() / 1000);
  const claimTimeoutElapsed =
    bounty.claimTimeoutSecs > 0 && now >= bounty.claimedAt + bounty.claimTimeoutSecs;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-bf-green">{bounty.title}</h1>
          <StatusBadge status={bounty.status} />
        </div>
        <p className="whitespace-pre-wrap text-sm text-bf-green-muted/70">{bounty.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-bf-border bg-bf-panel p-4 text-xs sm:grid-cols-4">
        <Info label="Reward" value={`${formatXlm(bounty.rewardStroops)} XLM`} accent />
        <Info label="Creator" value={shortenAddress(bounty.creator)} />
        <Info label="Claimant" value={bounty.claimant ? shortenAddress(bounty.claimant) : "—"} />
        <Info label="Bounty ID" value={`#${bounty.id}`} />
      </div>

      {bounty.submission && (
        <div className="rounded-lg border border-bf-border bg-bf-panel p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bf-green-muted/70">
            Submitted Work
          </h2>
          <p className="text-sm text-bf-green-muted/80">{bounty.submission.description}</p>
          {bounty.submission.link && (
            <a
              href={bounty.submission.link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-bf-green underline decoration-dotted"
            >
              {bounty.submission.link}
            </a>
          )}
        </div>
      )}

      {!address && (
        <button
          onClick={connect}
          className="rounded-md border border-bf-green-dim bg-bf-green/10 px-4 py-2 text-sm text-bf-green hover:bg-bf-green/20"
        >
          Connect Wallet to Act on This Bounty
        </button>
      )}

      {address && bounty.status === BountyStatus.Open && !isCreator && (
        <ActionBlock label="Claim this bounty and start work.">
          <button
            onClick={() => afterAction(() => claimTx.run())}
            disabled={claimTx.isBusy}
            className="rounded-md bg-bf-green px-4 py-2 text-sm font-semibold text-bf-black hover:bg-bf-green-muted disabled:opacity-50"
          >
            {claimTx.isBusy ? "Claiming..." : "Claim Bounty"}
          </button>
        </ActionBlock>
      )}

      {isClaimant && bounty.status === BountyStatus.Claimed && (
        <ActionBlock label="Submit your completed work for review.">
          <textarea
            value={submitDescription}
            onChange={(e) => setSubmitDescription(e.target.value)}
            rows={4}
            placeholder="What did you build/fix? Include anything the creator needs to review it."
            className="w-full rounded-md border border-bf-border bg-bf-black-soft px-3 py-2 text-sm text-bf-green-muted outline-none focus:border-bf-green-dim"
          />
          <input
            value={submitLink}
            onChange={(e) => setSubmitLink(e.target.value)}
            placeholder="Optional link (PR, deploy preview, etc.)"
            className="w-full rounded-md border border-bf-border bg-bf-black-soft px-3 py-2 text-sm text-bf-green-muted outline-none focus:border-bf-green-dim"
          />
          <button
            onClick={() => afterAction(() => submitTx.run())}
            disabled={submitTx.isBusy || !submitDescription.trim()}
            className="rounded-md bg-bf-green px-4 py-2 text-sm font-semibold text-bf-black hover:bg-bf-green-muted disabled:opacity-50"
          >
            {submitTx.isBusy ? "Submitting..." : "Submit Work"}
          </button>
        </ActionBlock>
      )}

      {isCreator && bounty.status === BountyStatus.Submitted && (
        <ActionBlock label="Review the submission above, then approve to release the reward.">
          <button
            onClick={() => afterAction(() => approveTx.run())}
            disabled={approveTx.isBusy}
            className="rounded-md bg-bf-green px-4 py-2 text-sm font-semibold text-bf-black hover:bg-bf-green-muted disabled:opacity-50"
          >
            {approveTx.isBusy ? "Releasing reward..." : `Approve & Release ${formatXlm(bounty.rewardStroops)} XLM`}
          </button>
        </ActionBlock>
      )}

      {isCreator && bounty.status === BountyStatus.Open && (
        <ActionBlock label="Cancel this bounty and reclaim escrowed XLM (only possible before it's claimed).">
          <button
            onClick={() => afterAction(() => cancelTx.run())}
            disabled={cancelTx.isBusy}
            className="rounded-md border border-bf-red/40 px-4 py-2 text-sm font-semibold text-bf-red hover:bg-bf-red/10 disabled:opacity-50"
          >
            {cancelTx.isBusy ? "Cancelling..." : "Cancel & Refund"}
          </button>
        </ActionBlock>
      )}

      {isCreator && bounty.status === BountyStatus.Claimed && claimTimeoutElapsed && (
        <ActionBlock label="The claim window has expired without a submission. You may cancel and reclaim escrow.">
          <button
            onClick={() => afterAction(() => cancelTx.run())}
            disabled={cancelTx.isBusy}
            className="rounded-md border border-bf-red/40 px-4 py-2 text-sm font-semibold text-bf-red hover:bg-bf-red/10 disabled:opacity-50"
          >
            {cancelTx.isBusy ? "Cancelling..." : "Cancel & Refund"}
          </button>
        </ActionBlock>
      )}

      <TransactionHistory
        transactions={[
          { label: "Claim", state: claimTx.state, completedStates: claimTx.completedStates },
          { label: "Submit work", state: submitTx.state, completedStates: submitTx.completedStates },
          { label: "Approve & release", state: approveTx.state, completedStates: approveTx.completedStates },
          { label: "Cancel & refund", state: cancelTx.state, completedStates: cancelTx.completedStates },
        ]}
      />
    </div>
  );
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-bf-green-muted/40">{label}</p>
      <p className={`mt-0.5 font-mono ${accent ? "font-semibold text-bf-green" : "text-bf-green-muted"}`}>{value}</p>
    </div>
  );
}

function ActionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-bf-border bg-bf-panel p-4">
      <p className="text-xs text-bf-green-muted/60">{label}</p>
      {children}
    </div>
  );
}

function TransactionHistory({
  transactions,
}: {
  transactions: Array<{ label: string; state: TxState; completedStates: TxState[] }>;
}) {
  const visibleTransactions = transactions.flatMap(({ label, state, completedStates }) => [
    ...completedStates.map((completedState) => ({ label, state: completedState })),
    ...(state.phase !== "idle" ? [{ label, state }] : []),
  ]);

  if (visibleTransactions.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-bf-green-muted/70">
        Transaction history
      </h2>
      {visibleTransactions.map(({ label, state }, index) => (
        <div key={`${label}-${index}`} className="space-y-1">
          <p className="text-xs font-medium text-bf-green-muted/70">{label}</p>
          <TxStatusBanner state={state} />
        </div>
      ))}
    </section>
  );
}
