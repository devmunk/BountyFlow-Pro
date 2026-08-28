export enum BountyStatus {
  Created = "Created",
  Open = "Open",
  Claimed = "Claimed",
  Submitted = "Submitted",
  Released = "Released",
  Refunded = "Refunded",
}

export interface Submission {
  description: string;
  link: string;
  submittedAt: number; // unix seconds
}

export interface Bounty {
  id: number;
  contractAddress: string;
  creator: string;
  title: string;
  description: string;
  rewardStroops: bigint;
  status: BountyStatus;
  claimant: string | null;
  submission: Submission | null;
  claimTimeoutSecs: number;
  createdAt: number;
  fundedAt: number;
  claimedAt: number;
}

export type TxState =
  | { phase: "idle" }
  | { phase: "preparing" }
  | { phase: "simulating" }
  | { phase: "awaiting-wallet" }
  | { phase: "submitted"; hash: string }
  | { phase: "confirming"; hash: string }
  | { phase: "success"; hash: string }
  | { phase: "error"; message: string; hash?: string };

export type BountyEventKind =
  | "created"
  | "funded"
  | "claimed"
  | "submitted"
  | "approved"
  | "released"
  | "refunded";

export interface BountyEvent {
  id: string; // ledger-sequence:event-index, used to dedupe
  kind: BountyEventKind;
  bountyAddress: string;
  ledger: number;
  timestamp: number;
  data: Record<string, string>;
}
