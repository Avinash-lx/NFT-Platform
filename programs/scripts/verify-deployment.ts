/**
 * Post-deploy smoke check.
 *
 * Connects to the cluster RPC and verifies that every PRISM program account
 * exists, is executable, and is owned by the upgradeable BPF loader. Also
 * reports whether the marketplace config PDA has been initialized.
 *
 * Program IDs are read from programs/deployments/<cluster>.json (written by
 * deploy.sh) and can be overridden by NEXT_PUBLIC_*_PROGRAM_ID env vars.
 *
 * Usage (from the `programs/` directory):
 *   npx ts-node scripts/verify-deployment.ts devnet
 *   npx ts-node scripts/verify-deployment.ts mainnet-beta
 *
 * Exits non-zero if any program is missing or not executable.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const BPF_UPGRADEABLE_LOADER = "BPFLoaderUpgradeab1e11111111111111111111111";

const RPC_BY_CLUSTER: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
  localhost: "http://127.0.0.1:8899",
};

const ENV_BY_PROGRAM: Record<string, string> = {
  marketplace_program: "NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID",
  rewards_program: "NEXT_PUBLIC_REWARDS_PROGRAM_ID",
  cashback_program: "NEXT_PUBLIC_CASHBACK_PROGRAM_ID",
  escrow_program: "NEXT_PUBLIC_ESCROW_PROGRAM_ID",
  nft_program: "NEXT_PUBLIC_NFT_PROGRAM_ID",
  royalty_program: "NEXT_PUBLIC_ROYALTY_PROGRAM_ID",
};

interface DeploymentRecord {
  cluster: string;
  rpcUrl?: string;
  programs: Record<string, string>;
}

function loadRecord(cluster: string): DeploymentRecord {
  const file = path.join(__dirname, "..", "deployments", `${cluster}.json`);
  let programs: Record<string, string> = {};
  let rpcUrl: string | undefined;

  if (fs.existsSync(file)) {
    const rec = JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentRecord;
    programs = { ...rec.programs };
    rpcUrl = rec.rpcUrl;
  }

  // Env overrides win (and can supply IDs without a committed record).
  for (const [name, envKey] of Object.entries(ENV_BY_PROGRAM)) {
    const v = process.env[envKey];
    if (v) programs[name] = v;
  }

  if (Object.keys(programs).length === 0) {
    throw new Error(
      `No program IDs found. Provide programs/deployments/${cluster}.json or set NEXT_PUBLIC_*_PROGRAM_ID.`,
    );
  }
  return { cluster, rpcUrl: process.env.RPC_URL ?? rpcUrl, programs };
}

async function main() {
  const cluster = process.argv[2] ?? process.env.CLUSTER ?? "devnet";
  const record = loadRecord(cluster);
  const rpcUrl = record.rpcUrl ?? RPC_BY_CLUSTER[cluster];
  if (!rpcUrl) throw new Error(`Unknown cluster: ${cluster}`);

  console.log(`Verifying PRISM deployment on ${cluster} (${rpcUrl})\n`);
  const connection = new Connection(rpcUrl, "confirmed");

  let failures = 0;

  for (const [name, idStr] of Object.entries(record.programs)) {
    if (!idStr) {
      console.log(`✗ ${name}: no program id`);
      failures++;
      continue;
    }
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(idStr);
    } catch {
      console.log(`✗ ${name}: invalid pubkey "${idStr}"`);
      failures++;
      continue;
    }

    const info = await connection.getAccountInfo(pubkey);
    if (!info) {
      console.log(`✗ ${name} (${idStr}): account not found on ${cluster}`);
      failures++;
    } else if (!info.executable) {
      console.log(`✗ ${name} (${idStr}): account is not executable`);
      failures++;
    } else if (info.owner.toBase58() !== BPF_UPGRADEABLE_LOADER) {
      console.log(
        `✗ ${name} (${idStr}): unexpected owner ${info.owner.toBase58()}`,
      );
      failures++;
    } else {
      console.log(`✓ ${name} (${idStr}): executable`);
    }
  }

  // Marketplace config PDA (warn-only — set up via init-marketplace).
  const marketplaceId = record.programs.marketplace_program;
  if (marketplaceId) {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("marketplace")],
      new PublicKey(marketplaceId),
    );
    const cfg = await connection.getAccountInfo(configPda);
    console.log(
      cfg
        ? `\n✓ marketplace config initialized (${configPda.toBase58()})`
        : `\n! marketplace config NOT initialized — run init-marketplace.ts (${configPda.toBase58()})`,
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} program(s) failed verification.`);
    process.exit(1);
  }
  console.log("\nAll programs verified on-chain ✅");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
