import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { connection } from "./solana";
import { PROGRAM_IDS, TOKEN_METADATA_PROGRAM_ID } from "@/lib/constants";
import { IDL } from "@/idl/nft_program";

const TOKEN_METADATA_PROGRAM = new PublicKey(TOKEN_METADATA_PROGRAM_ID);

/** Resolve the deployed NFT program id, or throw a helpful error. */
function programId(): PublicKey {
  const id = PROGRAM_IDS.nft;
  if (!id || id.startsWith("NFT1111")) {
    throw new Error(
      "NFT program is not deployed. Set NEXT_PUBLIC_NFT_PROGRAM_ID to the deployed address."
    );
  }
  return new PublicKey(id);
}

function getProgram(wallet: WalletContextState): Program {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Connect a wallet that can sign transactions");
  }
  const anchorWallet: Wallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
    payer: undefined as never,
  };
  const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
  const idl = { ...IDL, address: programId().toBase58() } as unknown as Idl;
  return new Program(idl, provider);
}

/** Token Metadata PDA: ["metadata", token_metadata_program, mint]. */
function metadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM
  )[0];
}

/** Master Edition PDA: ["metadata", token_metadata_program, mint, "edition"]. */
function masterEditionPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM
  )[0];
}

export interface MintNftParams {
  name: string;
  symbol: string;
  /** Metadata JSON URI (e.g. ipfs://…). */
  uri: string;
  /** Royalty in basis points (e.g. 500 = 5%). */
  sellerFeeBasisPoints: number;
}

/**
 * Mint an NFT entirely on-chain via the PRISM `nft_program`, which CPIs into the
 * Metaplex Token Metadata program to create the metadata + master edition. The
 * frontend only generates the mint keypair and signs; the chain does the mint.
 */
export async function mintNftOnChain(
  wallet: WalletContextState,
  params: MintNftParams
): Promise<{ mint: string; signature: string }> {
  const program = getProgram(wallet);
  const creator = wallet.publicKey!;
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const methods = program.methods as any;
  const signature: string = await methods
    .mintNft(params.name, params.symbol, params.uri, params.sellerFeeBasisPoints)
    .accountsPartial({
      creator,
      mint,
      tokenAccount: getAssociatedTokenAddressSync(mint, creator),
      metadata: metadataPda(mint),
      masterEdition: masterEditionPda(mint),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([mintKeypair])
    .rpc();

  return { mint: mint.toBase58(), signature };
}
