"use client";

import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  getWalletKit,
  rememberWallet,
  getRememberedWallet,
  forgetWallet,
} from "@/lib/wallet";
import { humanizeWalletError } from "@/lib/errors";

interface WalletState {
  address: string | null;
  walletName: string | null;
  connecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    walletName: null,
    connecting: false,
    error: null,
  });

  // Reconnect silently on mount if a wallet was previously selected and is
  // still authorized — this is what lets a pending-transaction reload
  // recover gracefully instead of losing wallet context.
  useEffect(() => {
    const rememberedId = getRememberedWallet();
    if (!rememberedId) return;
    let cancelled = false;
    (async () => {
      try {
        const kit = await getWalletKit();
        kit.setWallet(rememberedId);
        const { address } = await kit.getAddress();
        if (!cancelled) {
          setState((s) => ({ ...s, address, walletName: rememberedId }));
        }
      } catch {
        forgetWallet();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const result = await connectWallet();
      rememberWallet(result.walletId);
      setState({
        address: result.address,
        walletName: result.walletName,
        connecting: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({ ...s, connecting: false, error: humanizeWalletError(err) }));
    }
  }, []);

  const disconnect = useCallback(() => {
    forgetWallet();
    setState({ address: null, walletName: null, connecting: false, error: null });
  }, []);

  return { ...state, connect, disconnect };
}
