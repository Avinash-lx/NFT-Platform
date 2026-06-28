/**
 * Initialize the PRISM marketplace config (one-time, post-deploy).
 *
 * Sets the fee authority, the treasury that collects marketplace fees, and the
 * fee in basis points. Idempotent: exits cleanly if already initialized.
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

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idlPath = path.join(
    __dirname,
    "..",
    "target",
    "idl",
    "marketplace_program.json",
  );
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Run \`anchor build\` first.`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new anchor.Program(idl, provider);

  const feeBps = Number.parseInt(process.env.MARKETPLACE_FEE_BPS ?? "250", 10);
  const treasury = process.env.TREASURY_PUBKEY
    ? new PublicKey(process.env.TREASURY_PUBKEY)
    : provider.wallet.publicKey;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace")],
    program.programId,
  );

  // Skip if already initialized.
  const existing = await provider.connection.getAccountInfo(configPda);
  if (existing) {
    console.log(`Marketplace already initialized at ${configPda.toBase58()}`);
    return;
  }

  console.log(`Program:  ${program.programId.toBase58()}`);
  console.log(`Authority:${provider.wallet.publicKey.toBase58()}`);
  console.log(`Treasury: ${treasury.toBase58()}`);
  console.log(`Fee:      ${feeBps} bps`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sig = await (program.methods as any)
    .initializeMarketplace(feeBps)
    .accounts({
      authority: provider.wallet.publicKey,
      treasury,
      config: configPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`Initialized marketplace config ${configPda.toBase58()}`);
  console.log(`Signature: ${sig}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
