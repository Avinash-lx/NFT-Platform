import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "@/lib/constants";

export const connection = new Connection(RPC_URL, "confirmed");

/** Live SOL balance for an address. */
export async function getBalance(address: PublicKey): Promise<number> {
  const lamports = await connection.getBalance(address);
  return lamports / LAMPORTS_PER_SOL;
}

export interface RecentTx {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
}

/** Most recent transaction signatures for an address. */
export async function getRecentTransactions(
  address: PublicKey,
  limit = 5
): Promise<RecentTx[]> {
  const sigs = await connection.getSignaturesForAddress(address, { limit });
  return sigs.map((s) => ({
    signature: s.signature,
    slot: s.slot,
    blockTime: s.blockTime ?? null,
    err: s.err,
  }));
}
