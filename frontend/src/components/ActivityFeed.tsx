import type { Bounty, BountyEvent } from "@/types/bounty";
import { shortenAddress } from "@/lib/format";

const KIND_LABEL: Record<BountyEvent["kind"], string> = {
  created: "New bounty created",
  funded: "Bounty funded",
  claimed: "Bounty claimed",
  submitted: "Work submitted",
  approved: "Work approved",
  released: "Reward released",
  refunded: "Bounty refunded",
};

const KIND_COLOR: Record<BountyEvent["kind"], string> = {
  created: "bg-bf-green-dim",
  funded: "bg-bf-green",
  claimed: "bg-bf-amber",
  submitted: "bg-bf-amber",
  approved: "bg-bf-green",
  released: "bg-bf-green",
  refunded: "bg-bf-red",
};

interface ActivityFeedProps {
  events: BountyEvent[];
  bounties?: Bounty[];
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

export function ActivityFeed({
  events,
  bounties = [],
  onRefresh,
  refreshing = false,
}: ActivityFeedProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-bf-green">
          Live Activity
        </h2>

        <button
          type="button"
          onClick={() => void onRefresh?.()}
          disabled={!onRefresh || refreshing}
          className="flex items-center gap-1.5 rounded-md border border-bf-border px-2.5 py-1 text-xs text-bf-green-muted transition hover:border-bf-green-dim hover:text-bf-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={refreshing ? "animate-spin" : ""}>
            ↻
          </span>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-bf-green-muted/40">
          Live activity will appear here as bounties are created and progress.
        </p>
      ) : (
        <ul className="scrollbar-thin max-h-80 space-y-2 overflow-y-auto pr-1">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-2 rounded-md border border-bf-border bg-bf-panel/60 px-3 py-2 text-xs"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_COLOR[event.kind]}`}
              />

              <span className="text-bf-green-muted">
                {KIND_LABEL[event.kind]}
              </span>

              <span className="truncate text-bf-green">
                {bounties.find(
                  (bounty) =>
                    bounty.contractAddress === event.bountyAddress,
                )?.title ?? "Unknown bounty"}
              </span>

              <span className="ml-auto font-mono text-[11px] text-bf-green-muted/40">
                {shortenAddress(event.bountyAddress)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}