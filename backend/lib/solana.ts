import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "../config";

export const connection = new Connection(config.solana.rpcUrl, "confirmed");

/** Convert lamports (bigint) to SOL (number) for display/analytics. */
export function lamportsToSol(lamports: bigint | number): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/** Convert SOL to integer lamports. */
export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

/** Validate a base58 Solana address. */
export function isValidPublicKey(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the treasury keypair from TREASURY_WALLET_PRIVATE_KEY. Accepts either a
 * base58 secret key or a JSON array. Returns null when not configured so the API
 * can run in read-only mode locally.
 */
export function loadTreasuryKeypair(): Keypair | null {
  const raw = config.treasuryPrivateKey.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch (err) {
    console.warn("[solana] failed to parse treasury keypair:", (err as Error).message);
    return null;
  }
}
