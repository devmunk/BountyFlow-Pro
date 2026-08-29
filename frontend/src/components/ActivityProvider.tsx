"use client";

import { createContext, useCallback, useContext } from "react";
import { useBounties } from "@/hooks/useBounties";
import { useBountyEvents } from "@/hooks/useBountyEvents";
import type { Bounty, BountyEvent } from "@/types/bounty";

interface ActivityContextValue {
  bounties: Bounty[];
  events: BountyEvent[];
  loading: boolean;
  error: string | null;
  refreshOne: (id: number) => Promise<void>;
  refreshEvents: () => Promise<void>;
  refreshingEvents: boolean;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    bounties,
    loading,
    error,
    refresh,
    refreshOne,
  } = useBounties();

  const {
    feed: events,
    refresh: refreshEventStream,
    refreshing: refreshingEvents,
  } = useBountyEvents(
    (bountyAddress) => {
      const match = bounties.find(
        (bounty) => bounty.contractAddress === bountyAddress,
      );

      if (match) {
        void refreshOne(match.id);
      }
    },
    bounties.map((bounty) => bounty.contractAddress),
  );

  /**
   * Manual refresh:
   * 1. Refresh the complete bounty list so newly created bounties
   *    and their titles become available immediately.
   * 2. Refresh the event stream so newly indexed events appear.
   */
  const refreshEvents = useCallback(async () => {
    await Promise.all([
      refresh(),
      refreshEventStream(),
    ]);
  }, [refresh, refreshEventStream]);

  return (
    <ActivityContext.Provider
      value={{
        bounties,
        events,
        loading,
        error,
        refreshOne,
        refreshEvents,
        refreshingEvents,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);

  if (!context) {
    throw new Error("useActivity must be used inside ActivityProvider");
  }

  return context;
}