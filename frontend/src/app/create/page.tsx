"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useTransaction } from "@/hooks/useTransaction";
import { createBounty } from "@/lib/contracts/factory";
import { fundBounty } from "@/lib/contracts/bounty";
import { validateRewardInput, xlmToStroops } from "@/lib/format";
import { TxStatusBanner } from "@/components/TxStatusBanner";
import type { TxState } from "@/types/bounty";

const DEFAULT_TIMEOUT_SECS = Number(process.env.NEXT_PUBLIC_DEFAULT_CLAIM_TIMEOUT_SECS ?? 259200);

type Step = "form" | "created" | "funding" | "done";

export default function CreateBountyPage() {
  const router = useRouter();
  const { address, connect } = useWallet();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [newBounty, setNewBounty] = useState<{ id: number; address: string } | null>(null);

  const createTx = useTransaction((onState) => {
    if (!address) throw new Error("Connect your wallet first");
    const rewardStroops = xlmToStroops(reward);
    return createBounty({
      creator: address,
      title: title.trim(),
      description: description.trim(),
      rewardStroops,
      claimTimeoutSecs: DEFAULT_TIMEOUT_SECS,
      onState,
    });
  });

  const fundTx = useTransaction((onState: (s: TxState) => void) => {
    if (!address || !newBounty) throw new Error("Missing bounty context");
    return fundBounty(newBounty.address, address, onState);
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!address) {
      setFormError("Connect your wallet first.");
      return;
    }
    if (!title.trim()) {
      setFormError("Give your bounty a title.");
      return;
    }
    if (!description.trim()) {
      setFormError("Describe what needs to be done.");
      return;
    }
    const rewardCheck = validateRewardInput(reward);
    if (!rewardCheck.valid) {
      setFormError(rewardCheck.error ?? "Invalid reward");
      return;
    }

    const result = await createTx.run();
    if (result) {
      setNewBounty({ id: result.bountyId, address: result.bountyAddress });
      setStep("created");
    }
  }

  async function handleFund() {
    setStep("funding");
    const result = await fundTx.run();
    if (result) {
      setStep("done");
    } else {
      setStep("created");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-xl font-bold text-bf-green">Create a Bounty</h1>
      <p className="mb-6 text-sm text-bf-green-muted/60">
        Your reward is escrowed on-chain the moment you fund it — it can only leave the
        contract when you approve completed work, or when you cancel under the contract&apos;s
        refund rules.
      </p>

      {step === "form" && (
        <form onSubmit={handleCreate} className="space-y-5 rounded-lg border border-bf-border bg-bf-panel p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-bf-green-muted/70">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fix responsive layout bug on checkout page"
              className="w-full rounded-md border border-bf-border bg-bf-black-soft px-3 py-2 text-sm text-bf-green-muted outline-none focus:border-bf-green-dim"
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-bf-green-muted/70">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe the scope, acceptance criteria, and any relevant links."
              className="w-full rounded-md border border-bf-border bg-bf-black-soft px-3 py-2 text-sm text-bf-green-muted outline-none focus:border-bf-green-dim"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-bf-green-muted/70">Reward (XLM)</label>
            <input
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="25"
              inputMode="decimal"
              className="w-full rounded-md border border-bf-border bg-bf-black-soft px-3 py-2 text-sm text-bf-green-muted outline-none focus:border-bf-green-dim"
            />
          </div>

          {formError && <p className="text-xs text-bf-red">{formError}</p>}

          {!address ? (
            <button
              type="button"
              onClick={connect}
              className="w-full rounded-md bg-bf-green px-4 py-2.5 text-sm font-semibold text-bf-black hover:bg-bf-green-muted"
            >
              Connect Wallet to Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={createTx.isBusy}
              className="w-full rounded-md bg-bf-green px-4 py-2.5 text-sm font-semibold text-bf-black transition hover:bg-bf-green-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createTx.isBusy ? "Creating..." : "Create Bounty"}
            </button>
          )}

          <TxStatusBanner state={createTx.state} />
        </form>
      )}

      {(step === "created" || step === "funding" || step === "done") && newBounty && (
        <div className="space-y-5 rounded-lg border border-bf-border bg-bf-panel p-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bf-green-muted/70">
              1. Create bounty
            </h2>
            <TxStatusBanner state={createTx.state} />
          </section>

          <div className="rounded-md border border-bf-amber/40 bg-bf-amber/10 px-4 py-3 text-xs text-bf-amber">
            Bounty #{newBounty.id} was created but isn&apos;t visible on the board yet — it needs to
            be funded first. This second signature actually moves your {reward} XLM into escrow.
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bf-green-muted/70">
              2. Fund escrow
            </h2>
            {step !== "done" ? (
              <button
                onClick={handleFund}
                disabled={fundTx.isBusy}
                className="w-full rounded-md bg-bf-green px-4 py-2.5 text-sm font-semibold text-bf-black transition hover:bg-bf-green-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fundTx.isBusy ? "Funding escrow..." : `Deposit ${reward} XLM into Escrow`}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-bf-green">Escrow funded. Your bounty is now open.</p>
                <button
                  onClick={() => router.push(`/bounty/${newBounty.id}`)}
                  className="w-full rounded-md border border-bf-green-dim px-4 py-2.5 text-sm font-semibold text-bf-green transition hover:bg-bf-green/10"
                >
                  View Funded Bounty
                </button>
              </div>
            )}
            <TxStatusBanner state={fundTx.state} />
          </section>
        </div>
      )}
    </div>
  );
}
