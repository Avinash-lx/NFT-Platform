import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { connection, loadTreasuryKeypair } from "./solana";

/**
 * Minimal on-chain client for `cashback_program.request_cashback`, built without
 * Anchor so the backend stays dependency-light. The backend holds the treasury
 * authority key (it attests off-chain eligibility) and is the sole signer; the
 * program enforces single-claim-per-(user, mint) and pays from the treasury PDA.
 */

// sha256("global:request_cashback")[0..8]
const REQUEST_CASHBACK_DISCRIMINATOR = Buffer.from([
  109, 36, 121, 214, 180, 72, 252, 123,
]);

function programId(): PublicKey {
  const id =
    process.env.CASHBACK_PROGRAM_ID ?? process.env.NEXT_PUBLIC_CASHBACK_PROGRAM_ID ?? "";
  if (!id || id.startsWith("CSH1111")) {
    throw new Error(
      "Cashback program not deployed. Set CASHBACK_PROGRAM_ID to the deployed address."
    );
  }
  return new PublicKey(id);
}

function u64LE(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

export interface CashbackResult {
  signature: string;
  amountLamports: bigint;
}

/**
 * Pay cashback through the on-chain program. Returns the tx signature and the
 * amount paid (5% of purchase price, computed identically on-chain).
 */
export async function payCashbackOnChain(
  userWallet: string,
  mint: string,
  purchasePriceLamports: bigint
): Promise<CashbackResult> {
  const authority = loadTreasuryKeypair();
  if (!authority) throw new Error("Treasury wallet not configured");

  const program = programId();
  const user = new PublicKey(userWallet);
  const mintKey = new PublicKey(mint);

  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("cashback_treasury")],
    program
  );
  const [claimPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("cashback"), user.toBuffer(), mintKey.toBuffer()],
    program
  );

  // args: mint (Pubkey, 32) + purchase_price (u64 LE, 8)
  const data = Buffer.concat([
    REQUEST_CASHBACK_DISCRIMINATOR,
    mintKey.toBuffer(),
    u64LE(purchasePriceLamports),
  ]);

  const ix = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: user, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: claimPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [authority]
  );

  const amountLamports = (purchasePriceLamports * 5n) / 100n;
  return { signature, amountLamports };
}
