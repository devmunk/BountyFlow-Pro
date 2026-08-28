"use client";

import type { StellarWalletsKit, ISupportedWallet } from "@creit.tech/stellar-wallets-kit";
import { humanizeWalletError } from "./errors";

let kitInstance: StellarWalletsKit | null = null;

/**
 * Lazily creates a single shared StellarWalletsKit instance. `allowAllModules()`
 * only surfaces wallets the kit can actually detect/support in the current
 * browser — we never hardcode a wallet list that could advertise something
 * unavailable.
 */
export async function getWalletKit(): Promise<StellarWalletsKit> {
  if (typeof window === "undefined") {
    throw new Error("Wallet kit is only available in the browser");
  }
  const { StellarWalletsKit, WalletNetwork, allowAllModules } = await import("@creit.tech/stellar-wallets-kit");
  if (!kitInstance) {
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
      ? WalletNetwork.PUBLIC
      : WalletNetwork.TESTNET;
    kitInstance = new StellarWalletsKit({
      network,
      selectedWalletId: undefined,
      modules: allowAllModules(),
    });
  }
  return kitInstance;
}

export interface ConnectResult {
  address: string;
  walletId: string;
  walletName: string;
}

/** Opens the wallet picker modal and returns the selected wallet's address. */
export async function connectWallet(): Promise<ConnectResult> {
  const kit = await getWalletKit();
  return new Promise((resolve, reject) => {
    kit.openModal({
      onWalletSelected: async (option: ISupportedWallet) => {
        try {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          resolve({ address, walletId: option.id, walletName: option.name });
        } catch (err) {
          reject(new Error(humanizeWalletError(err)));
        }
      },
      onClosed: (err) => {
        if (err) reject(new Error(humanizeWalletError(err)));
      },
    });
  });
}

export async function signTransactionXdr(xdr: string): Promise<string> {
  try {
    const kit = await getWalletKit();
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
    });
    return signedTxXdr;
  } catch (err) {
    throw new Error(humanizeWalletError(err));
  }
}

export function disconnectWallet() {
  kitInstance = null;
}

const STORAGE_KEY = "bountyflow:lastWalletId";

export function rememberWallet(walletId: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, walletId);
  } catch {
    // localStorage can throw in private-browsing contexts; ignore, this is
    // a convenience feature only, never load-bearing for correctness.
  }
}

export function getRememberedWallet(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function forgetWallet() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
