"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToBountyEvents } from "@/lib/events";
import type { BountyEvent } from "@/types/bounty";

const MAX_FEED_LENGTH = 30;

/**
 * Subscribes to the live activity feed for as long as the calling component
 * is mounted, and always tears the subscription down on unmount — this is
 * the single place a polling interval is created for the event feed, so
 * there is exactly one interval alive at a time no matter how many times
 * the dashboard re-renders.
 */
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
        setFeed((prev) => [event, ...prev].slice(0, MAX_FEED_LENGTH));
        callbackRef.current?.(event.bountyAddress);
      },
      onError: () => {
        // Surfaced only via the feed staying stale; avoid noisy toasts for
        // what is usually a transient RPC blip that resolves on next poll.
      },
    });

    return () => subscription.stop();
  }, [contractIdsKey]);

  return feed;
}
