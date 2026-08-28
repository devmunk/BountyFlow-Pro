"use client";

import { createContext, useContext } from "react";
import { useBounties } from "@/hooks/useBounties";
import { useBountyEvents } from "@/hooks/useBountyEvents";
import type { Bounty, BountyEvent } from "@/types/bounty";

interface ActivityContextValue {
  bounties: Bounty[];
  events: BountyEvent[];
  loading: boolean;
  error: string | null;
  refreshOne: (id: number) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const { bounties, loading, error, refreshOne } = useBounties();
  const events = useBountyEvents((bountyAddress) => {
    const match = bounties.find((bounty) => bounty.contractAddress === bountyAddress);
    if (match) void refreshOne(match.id);
  }, bounties.map((bounty) => bounty.contractAddress));

  return (
    <ActivityContext.Provider value={{ bounties, events, loading, error, refreshOne }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error("useActivity must be used inside ActivityProvider");
  return context;
}
