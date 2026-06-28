import { LAMPORTS_PER_SOL } from "@solana/web3.js";

/** Truncate a wallet/mint address for display: `AbCd…WxYz`. */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/** Format a SOL amount with up to 4 decimals. */
export function formatSol(sol: number): string {
  return `${Number(sol).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`;
}

/** Convert lamports to SOL. */
export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/** Convert SOL to integer lamports. */
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/** Percentage from basis points (250 → "2.5%"). */
export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.00$/, "")}%`;
}
