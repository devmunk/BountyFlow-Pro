"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToBountyEvents } from "@/lib/events";
import type { BountyEvent } from "@/types/bounty";

const MAX_FEED_LENGTH = 30;

function compareEventsChronological(a: BountyEvent, b: BountyEvent): number {
  // Sort descending: newest on-chain events at the top
  if (a.ledger !== b.ledger) {
    return b.ledger - a.ledger;
  }
  // Secondary sort by event ID format (ledger:index)
  return b.id.localeCompare(a.id, undefined, { numeric: true });
}

export function useBountyEvents(
  onBountyChanged?: (bountyAddress: string) => void,
  contractIds: string[] = [],
) {
  const [feed, setFeed] = useState<BountyEvent[]>([]);
  const callbackRef = useRef(onBountyChanged);
  const createdAddressesRef = useRef(new Set<string>());
  callbackRef.current = onBountyChanged;
  const contractIdsKey = contractIds.join(",");

  useEffect(() => {
    const subscription = subscribeToBountyEvents({
      contractIds: contractIdsKey ? contractIdsKey.split(",") : [],
      onEvent: (event) => {
        if (event.kind === "created") {
          if (createdAddressesRef.current.has(event.bountyAddress)) return;
          createdAddressesRef.current.add(event.bountyAddress);
        }

        setFeed((prev) => {
          if (prev.some((e) => e.id === event.id)) return prev;
          const updated = [event, ...prev];
          updated.sort(compareEventsChronological);
          return updated.slice(0, MAX_FEED_LENGTH);
        });

        callbackRef.current?.(event.bountyAddress);
      },
      onError: () => {
        // Surfaced only via the feed staying stale; avoid noisy toasts
      },
    });

    return () => subscription.stop();
  }, [contractIdsKey]);

  return feed;
}