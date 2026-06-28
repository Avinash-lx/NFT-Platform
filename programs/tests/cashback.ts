import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import { CashbackProgram } from "../target/types/cashback_program";

describe("cashback_program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CashbackProgram as Program<CashbackProgram>;
  const authority = provider.wallet as anchor.Wallet;

  const [treasury] = PublicKey.findProgramAddressSync(
    [Buffer.from("cashback_treasury")],
    program.programId,
  );

  it("initializes and funds the treasury", async () => {
    await program.methods
      .initializeTreasury(authority.publicKey)
      .accounts({
        authority: authority.publicKey,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Fund the treasury PDA with 1 SOL.
    await provider.sendAndConfirm(
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: treasury,
          lamports: LAMPORTS_PER_SOL,
        }),
      ),
    );

    const acct = await program.account.treasury.fetch(treasury);
    assert.ok(acct.authority.equals(authority.publicKey));
  });

  it("pays 5% cashback to the recipient", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate().publicKey;
    const purchasePrice = new anchor.BN(LAMPORTS_PER_SOL); // 1 SOL

    const [claim] = PublicKey.findProgramAddressSync(
      [Buffer.from("cashback"), user.publicKey.toBuffer(), mint.toBuffer()],
      program.programId,
    );

    const before = await provider.connection.getBalance(user.publicKey);

    await program.methods
      .requestCashback(mint, purchasePrice)
      .accounts({
        authority: authority.publicKey,
        user: user.publicKey,
        treasury,
        claim,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const after = await provider.connection.getBalance(user.publicKey);
    assert.equal(after - before, 0.05 * LAMPORTS_PER_SOL); // 5% of 1 SOL

    const record = await program.account.cashbackClaim.fetch(claim);
    assert.equal(Number(record.amount), 0.05 * LAMPORTS_PER_SOL);
  });
});
