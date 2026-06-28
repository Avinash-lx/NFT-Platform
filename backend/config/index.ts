import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return parsed;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: int("PORT", 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",

  solana: {
    network: process.env.SOLANA_NETWORK ?? "devnet",
    rpcUrl: process.env.RPC_URL ?? "https://api.devnet.solana.com",
  },

  databaseUrl: required("DATABASE_URL", "postgresql://prism:prism@localhost:5432/prism"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  treasuryPrivateKey: process.env.TREASURY_WALLET_PRIVATE_KEY ?? "",
  marketplaceFeeBps: int("MARKETPLACE_FEE_BPS", 250),
  cashbackPercent: int("CASHBACK_PERCENT", 5),

  nftStorageApiKey: process.env.NFT_STORAGE_API_KEY ?? "",
} as const;

export type AppConfig = typeof config;
