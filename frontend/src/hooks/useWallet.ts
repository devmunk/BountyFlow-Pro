"use client";

import { useContext } from "react";
import { WalletContext } from "@/components/WalletProvider";

export function useWallet() {
  const context = useContext(WalletContext);

  if (context === null) {
    throw new Error(
      "useWallet must be used inside WalletProvider",
    );
  }

  return context;
}