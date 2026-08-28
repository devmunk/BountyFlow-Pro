import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTransaction } from "@/hooks/useTransaction";
import type { TxState } from "@/types/bounty";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useTransaction", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useTransaction(async (onState) => {
      onState({ phase: "success", hash: "x" });
      return "ok";
    }));
    expect(result.current.state.phase).toBe("idle");
    expect(result.current.isBusy).toBe(false);
  });

  it("transitions through phases reported by the action", async () => {
    const { result } = renderHook(() =>
      useTransaction(async (onState) => {
        onState({ phase: "preparing" });
        onState({ phase: "simulating" });
        onState({ phase: "success", hash: "abc" });
        return "done";
      }),
    );

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state).toEqual({ phase: "success", hash: "abc" });
    expect(result.current.isBusy).toBe(false);
  });

  it("ignores a second call while the first is still in flight", async () => {
    const d = deferred<void>();
    const action = vi.fn(async (onState: (s: TxState) => void) => {
      onState({ phase: "awaiting-wallet" });
      await d.promise;
      onState({ phase: "success", hash: "1" });
      return "result";
    });

    const { result } = renderHook(() => useTransaction(action));

    let firstCall: Promise<unknown>;
    act(() => {
      firstCall = result.current.run();
    });

    await waitFor(() => expect(result.current.isBusy).toBe(true));

    // A duplicate click/reload-retry while busy must not invoke the action again.
    await act(async () => {
      await result.current.run();
    });
    expect(action).toHaveBeenCalledTimes(1);

    d.resolve();
    await act(async () => {
      await firstCall!;
    });

    expect(result.current.state.phase).toBe("success");
  });

  it("sets a human-readable error state when the action throws", async () => {
    const { result } = renderHook(() =>
      useTransaction(async () => {
        throw new Error("insufficient balance for transfer");
      }),
    );

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state.phase).toBe("error");
    if (result.current.state.phase === "error") {
      expect(result.current.state.message).toMatch(/insufficient xlm balance/i);
    }
  });

  it("allows running again after a completed run", async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useTransaction(async (onState) => {
        calls += 1;
        onState({ phase: "success", hash: String(calls) });
        return calls;
      }),
    );

    await act(async () => {
      await result.current.run();
    });
    await act(async () => {
      await result.current.run();
    });

    expect(calls).toBe(2);
  });

  it("preserves a completed result when a new run starts", async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useTransaction(async (onState) => {
        calls += 1;
        onState({ phase: "success", hash: `hash-${calls}` });
        return calls;
      }),
    );

    await act(async () => {
      await result.current.run();
    });
    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state).toEqual({ phase: "success", hash: "hash-2" });
    expect(result.current.completedStates).toEqual([
      { phase: "success", hash: "hash-1" },
    ]);
  });
});
