import Link from "next/link";
import type { Bounty } from "@/types/bounty";
import { formatXlm, shortenAddress } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export function BountyCard({ bounty }: { bounty: Bounty }) {
  return (
    <Link
      href={`/bounty/${bounty.id}`}
      className="group flex flex-col justify-between rounded-lg border border-bf-border bg-bf-panel p-4 transition hover:border-bf-green-dim hover:shadow-glow"
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-bf-green-muted group-hover:text-bf-green">
            {bounty.title}
          </h3>
          <StatusBadge status={bounty.status} />
        </div>
        <p className="line-clamp-2 text-xs text-bf-green-muted/60">{bounty.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="font-mono font-semibold text-bf-green">{formatXlm(bounty.rewardStroops)} XLM</span>
        <span className="text-bf-green-muted/50">by {shortenAddress(bounty.creator)}</span>
      </div>
    </Link>
  );
}
