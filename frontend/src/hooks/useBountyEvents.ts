"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToBountyEvents } from "@/lib/events";
import type { BountyEvent } from "@/types/bounty";

const MAX_FEED_LENGTH = 30;

function compareEventsChronological(
  a: BountyEvent,
  b: BountyEvent,
): number {
  if (a.ledger !== b.ledger) {
    return b.ledger - a.ledger;
  }

  return b.id.localeCompare(a.id, undefined, {
    numeric: true,
  });
}

export function useBountyEvents(
  onBountyChanged?: (bountyAddress: string) => void,
  contractIds: string[] = [],
) {
  const [feed, setFeed] = useState<BountyEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const callbackRef = useRef(onBountyChanged);
  const createdAddressesRef = useRef(new Set<string>());
  const subscriptionRef = useRef<{
    refresh: () => Promise<void>;
    stop: () => void;
  } | null>(null);

  callbackRef.current = onBountyChanged;

  const contractIdsKey = contractIds.join(",");

  useEffect(() => {
    const subscription = subscribeToBountyEvents({
      contractIds: contractIdsKey
        ? contractIdsKey.split(",")
        : [],

      onEvent: (event) => {
        if (event.kind === "created") {
          if (
            createdAddressesRef.current.has(
              event.bountyAddress,
            )
          ) {
            return;
          }

          createdAddressesRef.current.add(
            event.bountyAddress,
          );
        }

        setFeed((prev) => {
          if (prev.some((e) => e.id === event.id)) {
            return prev;
          }

          const updated = [event, ...prev];

          updated.sort(compareEventsChronological);

          return updated.slice(0, MAX_FEED_LENGTH);
        });

        callbackRef.current?.(event.bountyAddress);
      },

      onError: () => {
        // Keep the feed quiet on transient RPC errors.
      },
    });

    subscriptionRef.current = subscription;

    return () => {
      subscriptionRef.current = null;
      subscription.stop();
    };
  }, [contractIdsKey]);

  const refresh = useCallback(async () => {
    if (!subscriptionRef.current) {
      return;
    }

    if (refreshing) {
      return;
    }

    setRefreshing(true);

    try {
      await subscriptionRef.current.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  return {
    feed,
    refresh,
    refreshing,
  };
}