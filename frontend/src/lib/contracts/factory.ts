import {
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";
import { simulateReadOnly, invokeContract } from "../soroban";
import type { TxState } from "@/types/bounty";

const FACTORY_ID = process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID!;

async function readOnly<T>(method: string, args: unknown[] = []): Promise<T> {
  return simulateReadOnly<T>(FACTORY_ID, method, args);
}

export async function getAllBountyIds(): Promise<number[]> {
  const ids = await readOnly<bigint[]>("get_all_bounty_ids");
  return ids.map((id) => Number(id));
}

export async function getBountyAddress(bountyId: number): Promise<string> {
  const addr = await readOnly<Address | string>("get_bounty_address", [
    nativeToScVal(bountyId, { type: "u64" }),
  ]);
  const address = typeof addr === "string" ? addr : addr.toString();
  if (!/^C[A-Z2-7]{55}$/.test(address)) {
    throw new Error(`Invalid contract address returned for bounty #${bountyId}`);
  }
  return address;
}

export async function getBountiesByCreator(creator: string): Promise<number[]> {
  const ids = await readOnly<bigint[]>("get_bounties_by_creator", [
    nativeToScVal(Address.fromString(creator), { type: "address" }),
  ]);
  return ids.map((id) => Number(id));
}

export async function createBounty(opts: {
  creator: string;
  title: string;
  description: string;
  rewardStroops: bigint;
  claimTimeoutSecs: number;
  onState: (state: TxState) => void;
}): Promise<{ bountyId: number; bountyAddress: string; hash: string }> {
  const { creator, title, description, rewardStroops, claimTimeoutSecs, onState } = opts;

  const { hash, returnValue } = await invokeContract({
    contractId: FACTORY_ID,
    method: "create_bounty",
    args: [
      nativeToScVal(Address.fromString(creator), { type: "address" }),
      nativeToScVal(title, { type: "string" }),
      nativeToScVal(description, { type: "string" }),
      nativeToScVal(rewardStroops, { type: "i128" }),
      nativeToScVal(claimTimeoutSecs, { type: "u64" }),
    ],
    sourceAddress: creator,
    onState,
  });

  let bountyId = 0;
  let bountyAddress = "";

  if (Array.isArray(returnValue)) {
    bountyId = Number(returnValue[0]);
    bountyAddress = typeof returnValue[1] === "string" ? returnValue[1] : returnValue[1].toString();
  } else if (typeof returnValue === "object" && returnValue !== null) {
    const obj = returnValue as Record<string, unknown>;
    bountyId = Number(obj["0"] ?? 0);
    bountyAddress = String(obj["1"] ?? "");
  }

  // Fallback if return parsing was skipped during simulation error safely
  if (!bountyAddress) {
    const allIds = await getAllBountyIds();
    if (allIds.length > 0) {
      bountyId = allIds[allIds.length - 1]!;
      bountyAddress = await getBountyAddress(bountyId);
    }
  }

  return { bountyId, bountyAddress, hash };
}