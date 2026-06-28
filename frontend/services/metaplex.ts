import { Metaplex, walletAdapterIdentity, Nft } from "@metaplex-foundation/js";
import { PublicKey } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { connection } from "./solana";

/** Build a Metaplex client bound to the connected wallet. */
export function getMetaplex(wallet: WalletContextState): Metaplex {
  return Metaplex.make(connection).use(walletAdapterIdentity(wallet));
}

export interface CreateNftParams {
  name: string;
  metadataUri: string;
  /** Royalty in basis points (e.g. 500 = 5%). */
  sellerFeeBasisPoints: number;
  collectionName?: string;
}

/**
 * Mint an NFT via Metaplex Token Metadata. Returns the mint address + signature.
 */
export async function createNft(
  wallet: WalletContextState,
  params: CreateNftParams
): Promise<{ mint: string; signature: string }> {
  const metaplex = getMetaplex(wallet);
  const { nft, response } = await metaplex.nfts().create({
    uri: params.metadataUri,
    name: params.name,
    sellerFeeBasisPoints: params.sellerFeeBasisPoints,
    isMutable: true,
  });
  return { mint: nft.address.toBase58(), signature: response.signature };
}

/** Fetch all NFTs owned by a wallet (used for NFT count + portfolio). */
export async function findNftsByOwner(
  wallet: WalletContextState,
  owner: PublicKey
): Promise<Nft[]> {
  const metaplex = getMetaplex(wallet);
  const nfts = await metaplex.nfts().findAllByOwner({ owner });
  // findAllByOwner returns Metadata; load full models lazily where needed.
  return nfts as unknown as Nft[];
}

/** Load a single NFT by mint address. */
export async function findNftByMint(
  wallet: WalletContextState,
  mint: string
): Promise<Nft> {
  const metaplex = getMetaplex(wallet);
  return metaplex.nfts().findByMint({ mintAddress: new PublicKey(mint) });
}
