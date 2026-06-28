/**
 * Initialize PRISM on-chain config (one-time, post-deploy). Idempotent.
 *
 * 1. marketplace config — authority + treasury + fee.
 * 2. rewards config — authority set to the marketplace's `rewards_authority`
 *    PDA, so only the marketplace `buy_nft` CPI can credit loyalty points.
 *
 * Usage (run from the `programs/` directory after `anchor build` + deploy):
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/id.json \
 *   TREASURY_PUBKEY=<pubkey> MARKETPLACE_FEE_BPS=250 \
 *   npx ts-node scripts/init-marketplace.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

function loadProgram(
  name: string,
  provider: anchor.AnchorProvider,
): anchor.Program {
  const idlPath = path.join(__dirname, "..", "target", "idl", `${name}.json`);
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Run \`anchor build\` first.`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  return new anchor.Program(idl, provider);
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const marketplace = loadProgram("marketplace_program", provider);
  const rewards = loadProgram("rewards_program", provider);
  const cashback = loadProgram("cashback_program", provider);

  // ── 1. Marketplace config ────────────────────────────────────────────
  const feeBps = Number.parseInt(process.env.MARKETPLACE_FEE_BPS ?? "250", 10);
  const treasury = process.env.TREASURY_PUBKEY
    ? new PublicKey(process.env.TREASURY_PUBKEY)
    : provider.wallet.publicKey;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace")],
    marketplace.programId,
  );

  if (await provider.connection.getAccountInfo(configPda)) {
    console.log(`Marketplace already initialized at ${configPda.toBase58()}`);
  } else {
    console.log(`Treasury: ${treasury.toBase58()}  Fee: ${feeBps} bps`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sig = await (marketplace.methods as any)
      .initializeMarketplace(feeBps)
      .accounts({
        authority: provider.wallet.publicKey,
        treasury,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(
      `Initialized marketplace config ${configPda.toBase58()} (${sig})`,
    );
  }

  // ── 2. Rewards config (authority = marketplace rewards_authority PDA) ──
  const [rewardsAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_authority")],
    marketplace.programId,
  );
  const [rewardsConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_config")],
    rewards.programId,
  );

  if (await provider.connection.getAccountInfo(rewardsConfig)) {
    console.log(
      `Rewards config already initialized at ${rewardsConfig.toBase58()}`,
    );
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sig = await (rewards.methods as any)
      .initializeConfig(rewardsAuthority)
      .accounts({
        payer: provider.wallet.publicKey,
        config: rewardsConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(
      `Initialized rewards config ${rewardsConfig.toBase58()} ` +
        `(authority = ${rewardsAuthority.toBase58()}) (${sig})`,
    );
  }

  // ── 3. Cashback treasury (authority = backend treasury wallet) ─────────
  const cashbackAuthority = process.env.CASHBACK_AUTHORITY_PUBKEY
    ? new PublicKey(process.env.CASHBACK_AUTHORITY_PUBKEY)
    : treasury;
  const [cashbackTreasury] = PublicKey.findProgramAddressSync(
    [Buffer.from("cashback_treasury")],
    cashback.programId,
  );

  if (await provider.connection.getAccountInfo(cashbackTreasury)) {
    console.log(
      `Cashback treasury already initialized at ${cashbackTreasury.toBase58()}`,
    );
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sig = await (cashback.methods as any)
      .initializeTreasury(cashbackAuthority)
      .accounts({
        authority: provider.wallet.publicKey,
        treasury: cashbackTreasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(
      `Initialized cashback treasury ${cashbackTreasury.toBase58()} ` +
        `(authority = ${cashbackAuthority.toBase58()}) (${sig})`,
    );
    console.log(
      `  → Fund it by sending SOL to ${cashbackTreasury.toBase58()} so cashback can be paid.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
