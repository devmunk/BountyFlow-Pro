"use client";

import { useCallback, useEffect, useState } from "react";
import { getAllBountyIds, getBountyAddress } from "@/lib/contracts/factory";
import { getBounty } from "@/lib/contracts/bounty";
import type { Bounty } from "@/types/bounty";

interface UseBountiesResult {
  bounties: Bounty[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshOne: (id: number) => Promise<void>;
}

export function useBounties(): UseBountiesResult {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ids = await getAllBountyIds();
      
      const loadedResults = await Promise.allSettled(
        ids.map(async (id) => {
          const address = await getBountyAddress(id);
          if (!address || typeof address !== "string" || !address.startsWith("C")) {
            throw new Error(`Invalid contract address for bounty #${id}`);
          }
          return getBounty(id, address);
        })
      );

      const loaded: Bounty[] = [];
      const failures: string[] = [];
      for (const result of loadedResults) {
        if (result.status === "fulfilled" && result.value) {
          loaded.push(result.value);
        } else if (result.status === "rejected") {
          failures.push(result.reason instanceof Error ? result.reason.message : "Bounty read failed");
        }
      }

      setBounties(loaded.sort((a, b) => b.id - a.id));
      if (failures.length > 0) {
        setError(`${failures.length} bounty read${failures.length === 1 ? "" : "s"} failed: ${failures[0]}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load bounties";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOne = useCallback(async (id: number) => {
    try {
      const address = await getBountyAddress(id);
      if (!address || typeof address !== "string" || !address.startsWith("C")) return;
      const updated = await getBounty(id, address);
      setBounties((prev) => {
        const exists = prev.some((b) => b.id === id);
        if (exists) {
          return prev.map((b) => (b.id === id ? updated : b));
        }
        return [updated, ...prev].sort((a, b) => b.id - a.id);
      });
    } catch {
      // Ignore single item refresh failures
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bounties, loading, error, refresh, refreshOne };
}