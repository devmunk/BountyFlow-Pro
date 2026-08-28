import {
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";
import { simulateReadOnly, invokeContract } from "../soroban";
import { Bounty, BountyStatus } from "@/types/bounty";
import type { TxState } from "@/types/bounty";

const STATUS_MAP: Record<string, BountyStatus> = {
  created: BountyStatus.Created,
  open: BountyStatus.Open,
  claimed: BountyStatus.Claimed,
  submitted: BountyStatus.Submitted,
  released: BountyStatus.Released,
  refunded: BountyStatus.Refunded,
  // Keep PascalCase fallbacks just in case
  Created: BountyStatus.Created,
  Open: BountyStatus.Open,
  Claimed: BountyStatus.Claimed,
  Submitted: BountyStatus.Submitted,
  Released: BountyStatus.Released,
  Refunded: BountyStatus.Refunded,
};

const STATUS_BY_VALUE: Record<number, BountyStatus> = {
  0: BountyStatus.Created,
  1: BountyStatus.Open,
  2: BountyStatus.Claimed,
  3: BountyStatus.Submitted,
  4: BountyStatus.Released,
  5: BountyStatus.Refunded,
};

async function readOnly<T>(bountyAddress: string, method: string, args: unknown[] = []): Promise<T> {
  return simulateReadOnly<T>(bountyAddress, method, args);
}

interface RawBountyData {
  factory: Address;
  creator: Address;
  token: Address;
  title: string;
  description: string;
  reward: bigint;
  claim_timeout_secs: bigint;
  status: { tag?: string } | number | string;
  claimant: Address | undefined;
  submission: { description: string; link: string; submitted_at: bigint } | undefined;
  created_at: bigint;
  funded_at: bigint;
  claimed_at: bigint;
}

export async function getBounty(id: number, bountyAddress: string): Promise<Bounty> {
  if (!/^C[A-Z2-7]{55}$/.test(bountyAddress)) {
    throw new Error("Invalid bounty contract address.");
  }
  const raw = await readOnly<RawBountyData>(bountyAddress, "get_bounty");
  const status = getBountyStatus(raw.status);
  return {
    id,
    contractAddress: bountyAddress,
    creator: raw.creator.toString(),
    title: raw.title,
    description: raw.description,
    rewardStroops: raw.reward,
    status,
    claimant: raw.claimant ? raw.claimant.toString() : null,
    submission: raw.submission
      ? {
          description: raw.submission.description,
          link: raw.submission.link,
          submittedAt: Number(raw.submission.submitted_at),
        }
      : null,
    claimTimeoutSecs: Number(raw.claim_timeout_secs),
    createdAt: Number(raw.created_at),
    fundedAt: Number(raw.funded_at),
    claimedAt: Number(raw.claimed_at),
  };
}

function getBountyStatus(rawStatus: RawBountyData["status"]): BountyStatus {
  if (typeof rawStatus === "number") {
    return STATUS_BY_VALUE[rawStatus] ?? BountyStatus.Created;
  }
  if (typeof rawStatus === "string") {
    return STATUS_MAP[rawStatus] ?? BountyStatus.Created;
  }
  return STATUS_MAP[rawStatus.tag ?? ""] ?? BountyStatus.Created;
}

export function fundBounty(bountyAddress: string, creator: string, onState: (s: TxState) => void) {
  return invokeContract({
    contractId: bountyAddress,
    method: "fund",
    args: [],
    sourceAddress: creator,
    onState,
  });
}

export function claimBounty(bountyAddress: string, claimant: string, onState: (s: TxState) => void) {
  return invokeContract({
    contractId: bountyAddress,
    method: "claim",
    args: [nativeToScVal(Address.fromString(claimant), { type: "address" })],
    sourceAddress: claimant,
    onState,
  });
}

export function submitWork(
  bountyAddress: string,
  claimant: string,
  description: string,
  link: string,
  onState: (s: TxState) => void,
) {
  return invokeContract({
    contractId: bountyAddress,
    method: "submit",
    args: [
      nativeToScVal(Address.fromString(claimant), { type: "address" }),
      nativeToScVal(description, { type: "string" }),
      nativeToScVal(link, { type: "string" }),
    ],
    sourceAddress: claimant,
    onState,
  });
}

export function approveBounty(bountyAddress: string, creator: string, onState: (s: TxState) => void) {
  return invokeContract({
    contractId: bountyAddress,
    method: "approve",
    args: [],
    sourceAddress: creator,
    onState,
  });
}

export function cancelBounty(bountyAddress: string, creator: string, onState: (s: TxState) => void) {
  return invokeContract({
    contractId: bountyAddress,
    method: "cancel",
    args: [],
    sourceAddress: creator,
    onState,
  });
}