"use client";

import { useCallback, useRef, useState } from "react";
import type { TxState } from "@/types/bounty";
import { humanizeContractError } from "@/lib/errors";

const TERMINAL_PHASES: TxState["phase"][] = ["idle", "success", "error"];

/**
 * Wraps a contract-invoking async function with explicit lifecycle state
 * (preparing -> simulating -> awaiting-wallet -> submitted -> confirming ->
 * success/error) and guards against duplicate submissions.
 */
export function useTransaction<TArgs extends unknown[], TResult>(
  action: (onState: (s: TxState) => void, ...args: TArgs) => Promise<TResult>,
) {
  const [state, setState] = useState<TxState>({ phase: "idle" });
  const [completedStates, setCompletedStates] = useState<TxState[]>([]);
  const stateRef = useRef<TxState>({ phase: "idle" });
  const inFlight = useRef(false);

  const updateState = useCallback((nextState: TxState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      const previous = stateRef.current;
      if (previous.phase === "success" || previous.phase === "error") {
        setCompletedStates((history) => [...history, previous]);
      }
      try {
        return await action(updateState, ...args);
      } catch (err) {
        const errorState: TxState = {
          phase: "error",
          message: humanizeContractError(err),
          hash: "hash" in stateRef.current ? stateRef.current.hash : undefined,
        };
        updateState(errorState);
        return undefined;
      } finally {
        inFlight.current = false;
      }
    },
    [action, updateState],
  );

  const reset = useCallback(() => updateState({ phase: "idle" }), [updateState]);

  return {
    state,
    completedStates,
    run,
    reset,
    isBusy: !TERMINAL_PHASES.includes(state.phase),
  };
}