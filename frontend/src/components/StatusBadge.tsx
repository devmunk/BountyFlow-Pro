import { BountyStatus } from "@/types/bounty";

const STYLES: Record<BountyStatus, string> = {
  [BountyStatus.Created]: "border-bf-border text-bf-green-muted/70",
  [BountyStatus.Open]: "border-bf-green-dim text-bf-green",
  [BountyStatus.Claimed]: "border-bf-amber/50 text-bf-amber",
  [BountyStatus.Submitted]: "border-bf-amber/50 text-bf-amber",
  [BountyStatus.Released]: "border-bf-green-dim bg-bf-green/10 text-bf-green",
  [BountyStatus.Refunded]: "border-bf-red/40 text-bf-red",
};

const LABELS: Record<BountyStatus, string> = {
  [BountyStatus.Created]: "Awaiting Funding",
  [BountyStatus.Open]: "Open",
  [BountyStatus.Claimed]: "Claimed",
  [BountyStatus.Submitted]: "In Review",
  [BountyStatus.Released]: "Completed",
  [BountyStatus.Refunded]: "Refunded",
};

export function StatusBadge({ status }: { status: BountyStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
