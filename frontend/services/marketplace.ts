import { AnchorProvider, BN, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { connection } from "./solana";
import { PROGRAM_IDS } from "@/lib/constants";
import { IDL } from "@/idl/marketplace_program";

/** Resolve the deployed marketplace program id, or throw a helpful error. */
function programId(): PublicKey {
  const id = PROGRAM_IDS.marketplace;
  if (!id || id.startsWith("MKT1111")) {
    throw new Error(
      "Marketplace program is not deployed. Set NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID to the deployed address."
    );
  }
  return new PublicKey(id);
}

/** Resolve the deployed rewards program id (needed for on-chain point accrual). */
function rewardsProgramId(): PublicKey {
  const id = PROGRAM_IDS.rewards;
  if (!id || id.startsWith("RWD1111")) {
    throw new Error(
      "Rewards program is not deployed. Set NEXT_PUBLIC_REWARDS_PROGRAM_ID to the deployed address."
    );
  }
  return new PublicKey(id);
}

/** Build an Anchor Program bound to the connected wallet. */
function getProgram(wallet: WalletContextState): Program {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Connect a wallet that can sign transactions");
  }
  const anchorWallet: Wallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
    payer: undefined as never, // unused in the browser; signing is delegated to the adapter
  };
  const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
  const idl = { ...IDL, address: programId().toBase58() } as unknown as Idl;
  return new Program(idl, provider);
}

// ───────────────────────────── PDAs ────────────────────────────────────

export function marketplaceConfigPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("marketplace")], programId())[0];
}

export function listingPda(seller: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), seller.toBuffer(), mint.toBuffer()],
    programId()
  )[0];
}

/** Rewards config PDA (in the rewards program). */
export function rewardsConfigPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_config")],
    rewardsProgramId()
  )[0];
}

/** A user's reward account PDA (in the rewards program). */
export function rewardAccountPda(user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rewards"), user.toBuffer()],
    rewardsProgramId()
  )[0];
}

/** Marketplace's rewards-authority PDA that signs the points CPI. */
export function rewardsAuthorityPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_authority")],
    programId()
  )[0];
}

// ───────────────────────────── Instructions ────────────────────────────

/**
 * List an owned NFT: locks the single NFT token into an escrow ATA owned by the
 * listing PDA. Returns the transaction signature.
 */
export async function listNftOnChain(
  wallet: WalletContextState,
  mintStr: string,
  priceLamports: number | bigint
): Promise<string> {
  const program = getProgram(wallet);
  const seller = wallet.publicKey!;
  const mint = new PublicKey(mintStr);
  const listing = listingPda(seller, mint);

  const methods = program.methods as any;
  return methods
    .listNft(new BN(priceLamports.toString()))
    .accountsPartial({
      seller,
      mint,
      sellerTokenAccount: getAssociatedTokenAddressSync(mint, seller),
      listing,
      escrowTokenAccount: getAssociatedTokenAddressSync(mint, listing, true),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

/**
 * Buy a listed NFT. Reads the marketplace config to resolve the treasury, pays
 * the seller + fee, and releases the NFT from escrow to the buyer.
 */
export async function buyNftOnChain(
  wallet: WalletContextState,
  mintStr: string,
  sellerStr: string
): Promise<string> {
  const program = getProgram(wallet);
  const buyer = wallet.publicKey!;
  const mint = new PublicKey(mintStr);
  const seller = new PublicKey(sellerStr);
  const config = marketplaceConfigPda();

  const cfg: any = await (program.account as any).marketplaceConfig.fetch(config);
  const listing = listingPda(seller, mint);

  const methods = program.methods as any;
  return methods
    .buyNft()
    .accountsPartial({
      buyer,
      seller,
      mint,
      config,
      treasury: cfg.treasury,
      listing,
      escrowTokenAccount: getAssociatedTokenAddressSync(mint, listing, true),
      buyerTokenAccount: getAssociatedTokenAddressSync(mint, buyer),
      rewardsConfig: rewardsConfigPda(),
      rewardAccount: rewardAccountPda(buyer),
      rewardsAuthority: rewardsAuthorityPda(),
      rewardsProgram: rewardsProgramId(),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

/** Cancel a listing and return the NFT from escrow to the seller. */
export async function cancelListingOnChain(
  wallet: WalletContextState,
  mintStr: string
): Promise<string> {
  const program = getProgram(wallet);
  const seller = wallet.publicKey!;
  const mint = new PublicKey(mintStr);
  const listing = listingPda(seller, mint);

  const methods = program.methods as any;
  return methods
    .cancelListing()
    .accountsPartial({
      seller,
      mint,
      listing,
      escrowTokenAccount: getAssociatedTokenAddressSync(mint, listing, true),
      sellerTokenAccount: getAssociatedTokenAddressSync(mint, seller),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}
