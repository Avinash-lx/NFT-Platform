import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { NftProgram } from "../target/types/nft_program";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

describe("nft_program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftProgram as Program<NftProgram>;
  const creator = provider.wallet as anchor.Wallet;

  it("mints a 1/1 NFT on-chain via Token Metadata CPI", async () => {
    const mintKp = Keypair.generate();
    const mint = mintKp.publicKey;

    const [metadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID,
    );
    const [masterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID,
    );
    const tokenAccount = getAssociatedTokenAddressSync(mint, creator.publicKey);

    await program.methods
      .mintNft("Cosmic Prism #1", "PRISM", "ipfs://example-metadata", 500)
      .accounts({
        creator: creator.publicKey,
        mint,
        tokenAccount,
        metadata,
        masterEdition,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKp])
      .rpc();

    // The creator holds exactly one token, and metadata + edition exist.
    const ata = await getAccount(provider.connection, tokenAccount);
    assert.equal(Number(ata.amount), 1);
    assert.ok(await provider.connection.getAccountInfo(metadata));
    assert.ok(await provider.connection.getAccountInfo(masterEdition));
  });
});
