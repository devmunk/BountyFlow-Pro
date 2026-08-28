import { rpc as SorobanRpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { getServer } from "./soroban";
import type { BountyEvent, BountyEventKind } from "@/types/bounty";

const FACTORY_ID = process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID!;
const INITIAL_LEDGER_LOOKBACK = 1000;

const TOPIC_TO_KIND: Record<string, BountyEventKind> = {
  // Factory / Creation
  bounty_created: "created",
  bounty_registered: "created",
  BountyCreated: "created",

  // Funding
  bounty_funded: "funded",
  BountyFunded: "funded",

  // Claiming
  bounty_claimed: "claimed",
  BountyClaimed: "claimed",

  // Submitting
  work_submitted: "submitted",
  WorkSubmitted: "submitted",

  // Approving & Releasing
  bounty_approved: "approved",
  BountyApproved: "approved",
  reward_released: "released",
  RewardReleased: "released",

  // Refunding
  bounty_refunded: "refunded",
  BountyRefunded: "refunded",
};

export interface EventSubscriptionOptions {
  /** Contract addresses to watch. The factory address is always included. */
  contractIds?: string[];
  /** Poll interval; defaults to 6s to stay well clear of RPC rate limits. */
  intervalMs?: number;
  onEvent: (event: BountyEvent) => void;
  onError?: (message: string) => void;
}

export interface EventSubscription {
  stop: () => void;
}

export function subscribeToBountyEvents(opts: EventSubscriptionOptions): EventSubscription {
  const { contractIds = [], intervalMs = 6000, onEvent, onError } = opts;

  // Ensure valid Soroban contract C... addresses
  const validIds = [FACTORY_ID, ...contractIds].filter(
    (id): id is string => typeof id === "string" && id.startsWith("C") && id.length === 56,
  );

  const watched = Array.from(new Set(validIds));
  const seen = new Set<string>();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cursorLedger: number | null = null;
  let eventCursor: string | null = null;

  async function poll() {
    if (stopped || watched.length === 0) return;
    try {
      const server = getServer();

      if (cursorLedger === null) {
        const latest = await server.getLatestLedger();
        cursorLedger = Math.max(latest.sequence - INITIAL_LEDGER_LOOKBACK, 1);
      }

      const filters: SorobanRpc.Api.EventFilter[] = [
        {
          type: "contract",
          contractIds: watched,
        },
      ];

      const response = await (eventCursor
        ? server.getEvents({ cursor: eventCursor, filters, limit: 100 })
        : server.getEvents({ startLedger: cursorLedger!, filters, limit: 100 }));

      for (const raw of response.events) {
        const id = `${raw.ledger}:${raw.id}`;
        if (seen.has(id)) continue;

        const topicSymbol = safeTopicName(raw.topic);
        let kind: BountyEventKind | undefined = topicSymbol ? TOPIC_TO_KIND[topicSymbol] : undefined;

        if (!kind && topicSymbol) {
          const lower = topicSymbol.toLowerCase();
          if (lower.includes("create") || lower.includes("register")) kind = "created";
          else if (lower.includes("fund")) kind = "funded";
          else if (lower.includes("claim")) kind = "claimed";
          else if (lower.includes("submit")) kind = "submitted";
          else if (lower.includes("approve")) kind = "approved";
          else if (lower.includes("release")) kind = "released";
          else if (lower.includes("refund")) kind = "refunded";
        }

        if (!kind) continue;
        seen.add(id);

        const data = safeEventData(raw.value);
        
        // Extract raw contract ID or topic address robustly
        const rawContract = typeof raw.contractId === "string" ? raw.contractId : String(raw.contractId ?? "");
        const topicAddress = raw.topic && raw.topic.length > 1 ? safeAddressTopic(raw.topic[1]) : null;

        const bountyAddress = data.bounty_address ?? topicAddress ?? rawContract;

        onEvent({
          id,
          kind,
          bountyAddress,
          ledger: raw.ledger,
          timestamp: raw.ledgerClosedAt ? Date.parse(raw.ledgerClosedAt) / 1000 : 0,
          data,
        });
      }

      if (seen.size > 2000) {
        seen.clear();
      }

      eventCursor = response.cursor;
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Event stream error");
    } finally {
      if (!stopped) {
        timer = setTimeout(poll, intervalMs);
      }
    }
  }

  poll();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

function safeTopicName(topics: unknown[]): string | null {
  try {
    if (!topics || !Array.isArray(topics) || topics.length === 0) return null;
    const first = topics[0];

    let valScVal: xdr.ScVal;
    if (typeof first === "string") {
      valScVal = xdr.ScVal.fromXDR(first, "base64");
    } else {
      valScVal = first as xdr.ScVal;
    }

    const native = scValToNative(valScVal);
    if (typeof native === "string") return native;
    if (typeof native === "symbol") return String(native.description || native);
    if (typeof native === "object" && native !== null) {
      const keys = Object.keys(native);
      return keys.length > 0 && keys[0] ? keys[0] : null;
    }
    return native !== undefined && native !== null ? String(native) : null;
  } catch {
    return null;
  }
}

function safeAddressTopic(topic: unknown): string | null {
  try {
    if (!topic) return null;
    let valScVal: xdr.ScVal;
    if (typeof topic === "string") {
      valScVal = xdr.ScVal.fromXDR(topic, "base64");
    } else {
      valScVal = topic as xdr.ScVal;
    }

    const value = scValToNative(valScVal);
    const address = typeof value === "string" ? value : String(value ?? "");
    return /^C[A-Z2-7]{55}$/.test(address) ? address : null;
  } catch {
    return null;
  }
}

function safeEventData(value: unknown): Record<string, string> {
  try {
    if (!value) return {};
    let valScVal: xdr.ScVal;
    if (typeof value === "string") {
      valScVal = xdr.ScVal.fromXDR(value, "base64");
    } else {
      valScVal = value as xdr.ScVal;
    }

    const native = scValToNative(valScVal);
    if (native && typeof native === "object") {
      return Object.fromEntries(
        Object.entries(native as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
      );
    }
    return { value: String(native) };
  } catch {
    return {};
  }
}