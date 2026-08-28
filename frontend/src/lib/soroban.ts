import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  Account,
  BASE_FEE,
  scValToNative,
} from "@stellar/stellar-sdk";
import { signTransactionXdr } from "./wallet";
import { humanizeContractError } from "./errors";
import type { TxState } from "@/types/bounty";

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL!;
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!;

let serverInstance: SorobanRpc.Server | null = null;

export function getServer(): SorobanRpc.Server {
  if (!serverInstance) {
    serverInstance = new SorobanRpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
  }
  return serverInstance;
}

export function getContract(contractId: string): Contract {
  if (!isContractAddress(contractId)) {
    throw new Error("Invalid Soroban contract address.");
  }
  return new Contract(contractId);
}

export async function simulateReadOnly<T>(
  contractId: string,
  method: string,
  args: unknown[] = [],
): Promise<T> {
  const server = getServer();
  const account = new Account(getReadOnlySource(), "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(getContract(contractId).call(method, ...(args as never[])))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulated)) {
    throw new Error(simulated.error);
  }
  if (!SorobanRpc.Api.isSimulationSuccess(simulated) || !simulated.result) {
    throw new Error("Simulation did not return a result");
  }
  return scValToNative(simulated.result.retval) as T;
}

function getReadOnlySource(): string {
  const source = process.env.NEXT_PUBLIC_READ_ONLY_SOURCE ??
    "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
  if (!isAccountAddress(source)) {
    throw new Error("Invalid read-only account address.");
  }
  return source;
}

function isAccountAddress(value: string): boolean {
  return typeof value === "string" && /^G[A-Z2-7]{55}$/.test(value);
}

function isContractAddress(value: string): boolean {
  return typeof value === "string" && /^C[A-Z2-7]{55}$/.test(value);
}

export async function invokeContract(opts: {
  contractId: string;
  method: string;
  args: unknown[];
  sourceAddress: string;
  onState: (state: TxState) => void;
}): Promise<{ hash: string; returnValue: unknown }> {
  const { contractId, method, args, sourceAddress, onState } = opts;
  const server = getServer();

  try {
    onState({ phase: "preparing" });
    const account: Account = await server.getAccount(sourceAddress);
    const contract = getContract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...(args as never[])))
      .setTimeout(60)
      .build();

    onState({ phase: "simulating" });
    const simulated = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simulated)) {
      throw new Error(simulated.error);
    }
    if (!SorobanRpc.Api.isSimulationSuccess(simulated) || !simulated.result) {
      throw new Error("Simulation did not return a result");
    }

    // Safely attempt parsing simulated retval; fall back gracefully if scValToNative throws
    let returnValue: unknown = null;
    try {
      if (simulated.result.retval) {
        returnValue = scValToNative(simulated.result.retval);
      }
    } catch {
      returnValue = null;
    }

    const preparedBuilder = SorobanRpc.assembleTransaction(tx, simulated);
    const preparedTx = preparedBuilder.build();

    onState({ phase: "awaiting-wallet" });
    const signedXdr = await signTransactionXdr(preparedTx.toXDR());
    const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

    const sendResult = await server.sendTransaction(signedTx);
    if (sendResult.status === "ERROR") {
      throw new Error(JSON.stringify(sendResult.errorResult ?? sendResult));
    }
    const hash = sendResult.hash;
    onState({ phase: "submitted", hash });

    onState({ phase: "confirming", hash });
    const result = await pollForConfirmation(server, hash);

    if (result.status === "SUCCESS") {
      onState({ phase: "success", hash });
      return { hash, returnValue };
    }

    throw new Error(
      result.status === "FAILED" ? "Transaction failed on-chain" : `Unexpected status: ${result.status}`
    );
  } catch (err) {
    const message = humanizeContractError(err);
    const hash = (err as { hash?: string })?.hash;
    onState({ phase: "error", message, hash });
    throw err;
  }
}

async function pollForConfirmation(
  server: SorobanRpc.Server,
  hash: string,
  { intervalMs = 2000, timeoutMs = 60_000 } = {},
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await server.getTransaction(hash);
    if (response.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      return response;
    }
    await sleep(intervalMs);
  }
  throw new Error("Timed out waiting for transaction confirmation.");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function explorerTxUrl(hash: string): string {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}