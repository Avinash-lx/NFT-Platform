import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { MarketplaceProgram } from "../target/types/marketplace_program";

describe("marketplace_program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .MarketplaceProgram as Program<MarketplaceProgram>;

  const authority = provider.wallet as anchor.Wallet;
  const treasury = Keypair.generate();
  const seller = Keypair.generate();
  const buyer = Keypair.generate();

  let mint: PublicKey;
  let sellerAta: PublicKey;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace")],
    program.programId
  );

  const price = new anchor.BN(LAMPORTS_PER_SOL); // 1 SOL

  before(async () => {
    // Fund participants.
    for (const kp of [seller, buyer]) {
      const sig = await provider.connection.requestAirdrop(
        kp.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    }

    // Create a 0-decimal mint and mint exactly one token to the seller (an NFT).
    mint = await createMint(
      provider.connection,
      seller,
      seller.publicKey,
      null,
      0
    );
    sellerAta = await createAssociatedTokenAccount(
      provider.connection,
      seller,
      mint,
      seller.publicKey
    );
    await mintTo(provider.connection, seller, mint, sellerAta, seller, 1);
  });

  it("initializes the marketplace", async () => {
    await program.methods
      .initializeMarketplace(250)
      .accounts({
        authority: authority.publicKey,
        treasury: treasury.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.marketplaceConfig.fetch(configPda);
    assert.equal(config.feeBps, 250);
    assert.ok(config.treasury.equals(treasury.publicKey));
  });

  it("lists an NFT into escrow", async () => {
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), seller.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );
    const escrowAta = getAssociatedTokenAddressSync(mint, listingPda, true);

    await program.methods
      .listNft(price)
      .accounts({
        seller: seller.publicKey,
        mint,
        sellerTokenAccount: sellerAta,
        listing: listingPda,
        escrowTokenAccount: escrowAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    const escrow = await getAccount(provider.connection, escrowAta);
    assert.equal(Number(escrow.amount), 1);

    const listing = await program.account.listing.fetch(listingPda);
    assert.ok(listing.price.eq(price));
  });

  it("lets a buyer purchase the NFT", async () => {
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), seller.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );
    const escrowAta = getAssociatedTokenAddressSync(mint, listingPda, true);
    const buyerAta = getAssociatedTokenAddressSync(mint, buyer.publicKey);

    const treasuryBefore = await provider.connection.getBalance(
      treasury.publicKey
    );

    await program.methods
      .buyNft()
      .accounts({
        buyer: buyer.publicKey,
        seller: seller.publicKey,
        mint,
        config: configPda,
        treasury: treasury.publicKey,
        listing: listingPda,
        escrowTokenAccount: escrowAta,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const buyerToken = await getAccount(provider.connection, buyerAta);
    assert.equal(Number(buyerToken.amount), 1);

    const treasuryAfter = await provider.connection.getBalance(
      treasury.publicKey
    );
    // 2.5% of 1 SOL.
    assert.equal(treasuryAfter - treasuryBefore, 0.025 * LAMPORTS_PER_SOL);
  });
});
