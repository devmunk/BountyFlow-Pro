"use client";

import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/format";

export function WalletButton() {
  const { address, walletName, connecting, error, connect, disconnect } = useWallet();

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div className="rounded-md border border-bf-border bg-bf-panel px-3 py-1.5 text-xs">
          <span className="text-bf-green-dim">{walletName ?? "Wallet"}</span>{" "}
          <span className="text-bf-green">{shortenAddress(address)}</span>
        </div>
        <button
          onClick={disconnect}
          className="rounded-md border border-bf-border px-2.5 py-1.5 text-xs text-bf-green-muted/70 transition hover:border-bf-red/50 hover:text-bf-red"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={connecting}
        className="rounded-md border border-bf-green-dim bg-bf-green/10 px-4 py-1.5 text-sm font-medium text-bf-green transition hover:bg-bf-green/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <p className="max-w-[220px] text-right text-[11px] text-bf-red">{error}</p>}
    </div>
  );
}
