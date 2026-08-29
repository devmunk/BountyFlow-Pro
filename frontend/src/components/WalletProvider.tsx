"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";

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

export interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const WalletContext =
  createContext<WalletContextValue | null>(null);

export function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<WalletState>({
    address: null,
    walletName: null,
    connecting: false,
    error: null,
  });

  useEffect(() => {
    const rememberedId = getRememberedWallet();

    if (rememberedId === null) {
      return;
    }

    const walletId: string = rememberedId;

    let cancelled = false;

    async function reconnect() {
      try {
        const kit = await getWalletKit();

        if (cancelled) {
          return;
        }

        kit.setWallet(walletId);

        const { address } = await kit.getAddress();

        if (cancelled) {
          return;
        }

        if (
          typeof address === "string" &&
          /^G[A-Z2-7]{55}$/.test(address)
        ) {
          setState({
            address,
            walletName: walletId,
            connecting: false,
            error: null,
          });
        } else {
          forgetWallet();
        }
      } catch {
        if (!cancelled) {
          forgetWallet();

          setState({
            address: null,
            walletName: null,
            connecting: false,
            error: null,
          });
        }
      }
    }

    void reconnect();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setState((current) => ({
      ...current,
      connecting: true,
      error: null,
    }));

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
      setState((current) => ({
        ...current,
        connecting: false,
        error: humanizeWalletError(err),
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    forgetWallet();

    setState({
      address: null,
      walletName: null,
      connecting: false,
      error: null,
    });
  }, []);

  const contextValue: WalletContextValue = {
    address: state.address,
    walletName: state.walletName,
    connecting: state.connecting,
    error: state.error,
    connect,
    disconnect,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}