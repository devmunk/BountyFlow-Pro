"use client";

import { useCallback, useRef, useState } from "react";
import type { TxState } from "@/types/bounty";
import { humanizeWalletError } from "@/lib/errors";

const TERMINAL_PHASES: TxState["phase"][] = [
  "idle",
  "success",
  "error",
];

/**
 * Wraps a contract-invoking async function with explicit lifecycle state.
 *
 * The latest action is stored in a ref so that run() always executes the
 * action from the latest render. This is important when the action depends
 * on changing values such as the connected wallet address.
 */
export function useTransaction<
  TArgs extends unknown[],
  TResult,
>(
  action: (
    onState: (s: TxState) => void,
    ...args: TArgs
  ) => Promise<TResult>,
) {
  const [state, setState] = useState<TxState>({
    phase: "idle",
  });

  const [completedStates, setCompletedStates] = useState<TxState[]>(
    [],
  );

  const stateRef = useRef<TxState>({
    phase: "idle",
  });

  const actionRef = useRef(action);

  const inFlight = useRef(false);

  // Always keep the latest action available.
  // This prevents stale wallet addresses from being captured
  // when the hook was created before the wallet connected.
  actionRef.current = action;

  const updateState = useCallback((nextState: TxState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlight.current) {
        return undefined;
      }

      inFlight.current = true;

      const previous = stateRef.current;

      if (
        previous.phase === "success" ||
        previous.phase === "error"
      ) {
        setCompletedStates((history) => [
          ...history,
          previous,
        ]);
      }

      try {
        return await actionRef.current(updateState, ...args);
      } catch (err) {
        const errorState: TxState = {
          phase: "error",
          message: humanizeWalletError(err),
          hash:
            "hash" in stateRef.current
              ? stateRef.current.hash
              : undefined,
        };

        updateState(errorState);

        return undefined;
      } finally {
        inFlight.current = false;
      }
    },
    [updateState],
  );

  const reset = useCallback(() => {
    updateState({ phase: "idle" });
  }, [updateState]);

  return {
    state,
    completedStates,
    run,
    reset,
    isBusy: !TERMINAL_PHASES.includes(state.phase),
  };
}