import { clusterApiUrl } from "@solana/web3.js";
import type { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ??
  "devnet") as WalletAdapterNetwork;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? clusterApiUrl(SOLANA_NETWORK);

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const NFT_STORAGE_API_KEY =
  process.env.NEXT_PUBLIC_NFT_STORAGE_API_KEY ?? "";

export const PROGRAM_IDS = {
  marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID ?? "",
  rewards: process.env.NEXT_PUBLIC_REWARDS_PROGRAM_ID ?? "",
  cashback: process.env.NEXT_PUBLIC_CASHBACK_PROGRAM_ID ?? "",
  escrow: process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID ?? "",
  nft: process.env.NEXT_PUBLIC_NFT_PROGRAM_ID ?? "",
  royalty: process.env.NEXT_PUBLIC_ROYALTY_PROGRAM_ID ?? "",
};

/** Metaplex Token Metadata program (same address on all clusters). */
export const TOKEN_METADATA_PROGRAM_ID =
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

export const MARKETPLACE_FEE_BPS = 250; // default Bronze fee
export const SOLSCAN_BASE =
  SOLANA_NETWORK === "mainnet-beta"
    ? "https://solscan.io"
    : `https://solscan.io/?cluster=${SOLANA_NETWORK}`;

export function solscanTx(signature: string): string {
  return SOLANA_NETWORK === "mainnet-beta"
    ? `https://solscan.io/tx/${signature}`
    : `https://solscan.io/tx/${signature}?cluster=${SOLANA_NETWORK}`;
}

export function solscanAddress(address: string): string {
  return SOLANA_NETWORK === "mainnet-beta"
    ? `https://solscan.io/account/${address}`
    : `https://solscan.io/account/${address}?cluster=${SOLANA_NETWORK}`;
}
