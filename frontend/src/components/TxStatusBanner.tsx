"use client";

import type { TxState } from "@/types/bounty";
import { explorerTxUrl } from "@/lib/soroban";

const PHASE_LABEL: Record<TxState["phase"], string> = {
  idle: "",
  preparing: "Preparing transaction...",
  simulating: "Simulating on-chain...",
  "awaiting-wallet": "Waiting for wallet approval...",
  submitted: "Submitted to network...",
  confirming: "Confirming on-chain...",
  success: "Confirmed",
  error: "Failed",
};

export function TxStatusBanner({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;

  const isError = state.phase === "error";
  const isSuccess = state.phase === "success";
  const isPending = !isError && !isSuccess;
  const hash = "hash" in state ? state.hash : undefined;

  return (
    <div
      className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-xs ${
        isError
          ? "border-bf-red/40 bg-bf-red/10 text-bf-red"
          : isSuccess
            ? "border-bf-green-dim bg-bf-green/10 text-bf-green"
            : "border-bf-border bg-bf-panel text-bf-green-muted"
      }`}
    >
      <div className="flex items-center gap-2">
        {isPending && (
          <span className="h-2 w-2 animate-pulse-glow rounded-full bg-bf-amber" />
        )}
        <span>{PHASE_LABEL[state.phase]}</span>
      </div>
      {isError && "message" in state && <p className="text-[11px] opacity-90">{state.message}</p>}
      {hash && (
        <div className="flex flex-col gap-1">
          <code className="break-all text-[11px] opacity-80">{hash}</code>
          {isSuccess && (
            <a
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-[11px] underline decoration-dotted underline-offset-2 opacity-80 hover:opacity-100"
            >
              View transaction on Stellar Expert
            </a>
          )}
        </div>
      )}
    </div>
  );
}
