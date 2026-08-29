"use client";

import type {
  StellarWalletsKit,
  ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import { humanizeWalletError } from "./errors";

let kitInstance: StellarWalletsKit | null = null;

export async function getWalletKit(): Promise<StellarWalletsKit> {
  if (typeof window === "undefined") {
    throw new Error("Wallet kit is only available in the browser");
  }

  const {
    StellarWalletsKit,
    WalletNetwork,
    FreighterModule,
    xBullModule,
    AlbedoModule,
  } = await import("@creit.tech/stellar-wallets-kit");

  if (!kitInstance) {
    const network =
      process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
        ? WalletNetwork.PUBLIC
        : WalletNetwork.TESTNET;

    kitInstance = new StellarWalletsKit({
      network,
      selectedWalletId: undefined,
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new AlbedoModule(),
      ],
    });
  }

  return kitInstance;
}

export interface ConnectResult {
  address: string;
  walletId: string;
  walletName: string;
}

function isValidStellarAddress(
  address: unknown,
): address is string {
  return (
    typeof address === "string" &&
    /^G[A-Z2-7]{55}$/.test(address)
  );
}

/**
 * Opens the wallet picker and connects to the selected wallet.
 *
 * Freighter is handled directly through freighter-api because
 * Stellar Wallets Kit's FreighterModule internally chains
 * requestAccess() and getAddress(), which does not give us
 * reliable cancellation handling for this application.
 */
export async function connectWallet(): Promise<ConnectResult> {
  const kit = await getWalletKit();

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      try {
        kit.setWallet("");
      } catch {
        // Ignore cleanup errors.
      }
    };

    const fail = (error: unknown) => {
      if (settled) return;

      settled = true;
      cleanup();

      reject(
        error instanceof Error
          ? error
          : new Error(humanizeWalletError(error)),
      );
    };

    const succeed = (result: ConnectResult) => {
      if (settled) return;

      settled = true;
      resolve(result);
    };

    kit.openModal({
      onWalletSelected: async (
        option: ISupportedWallet,
      ) => {
        if (settled) return;

        try {
          /*
           * Freighter:
           *
           * Do NOT use kit.getAddress() here.
           * The Freighter module internally performs its own
           * requestAccess() flow.
           */
          if (option.id === "freighter") {
            const {
              requestAccess,
              getAddress,
            } = await import("@stellar/freighter-api");

            const access = await requestAccess();

            if (access?.error) {
              throw access.error;
            }

            const addressFromAccess = access?.address;

            if (!isValidStellarAddress(addressFromAccess)) {
              throw new Error(
                "Wallet connection cancelled.",
              );
            }

            const addressResult = await getAddress();

            if (addressResult?.error) {
              throw addressResult.error;
            }

            const address = addressResult?.address;

            if (!isValidStellarAddress(address)) {
              throw new Error(
                "Wallet connection cancelled.",
              );
            }

            succeed({
              address,
              walletId: option.id,
              walletName: option.name,
            });

            return;
          }

          /*
           * xBull / Albedo:
           * Continue using Stellar Wallets Kit.
           */
          kit.setWallet(option.id);

          const result = await kit.getAddress();
          const address = result?.address;

          if (!isValidStellarAddress(address)) {
            throw new Error(
              "Wallet connection cancelled.",
            );
          }

          succeed({
            address,
            walletId: option.id,
            walletName: option.name,
          });
        } catch (err) {
          fail(err);
        }
      },

      /*
       * Closing the Wallets Kit picker without completing
       * connection must always reject the connection attempt.
       */
      onClosed: (err) => {
        if (settled) return;

        fail(
          err ??
            new Error(
              "Wallet connection cancelled.",
            ),
        );
      },
    });
  });
}

export async function signTransactionXdr(
  xdr: string,
): Promise<string> {
  const kit = await getWalletKit();

  try {
    const result = await kit.signTransaction(xdr, {
      networkPassphrase:
        process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
    });

    if (!result?.signedTxXdr) {
      throw new Error(
        "Transaction signing cancelled.",
      );
    }

    return result.signedTxXdr;
  } catch (err) {
    throw new Error(
      humanizeWalletError(err),
    );
  }
}

export function disconnectWallet() {
  if (kitInstance) {
    try {
      kitInstance.setWallet("");
    } catch {
      // Ignore cleanup errors.
    }
  }

  kitInstance = null;
}

const STORAGE_KEY =
  "bountyflow:lastWalletId";

export function rememberWallet(
  walletId: string,
) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      walletId,
    );
  } catch {
    // Ignore localStorage errors.
  }
}

export function getRememberedWallet():
  | string
  | null {
  try {
    return window.localStorage.getItem(
      STORAGE_KEY,
    );
  } catch {
    return null;
  }
}

export function forgetWallet() {
  try {
    window.localStorage.removeItem(
      STORAGE_KEY,
    );
  } catch {
    // Ignore localStorage errors.
  }
}