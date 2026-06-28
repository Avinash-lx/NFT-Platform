import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, jsonSafe } from "../lib/http";
import { isValidPublicKey } from "../lib/solana";
import { upsertUser } from "../lib/users";
import { cacheDel } from "../lib/redis";

const createNftSchema = z.object({
  mint: z.string().refine(isValidPublicKey, "Invalid mint address"),
  name: z.string().min(1).max(32),
  description: z.string().max(2000).optional(),
  imageUri: z.string().url(),
  metadataUri: z.string().url(),
  collection: z.string().max(64).optional(),
  royaltyBps: z.number().int().min(0).max(10000).default(0),
  wallet: z.string().refine(isValidPublicKey, "Invalid wallet address"),
});

/**
 * Persist a freshly minted NFT. Called after the client completes the Metaplex
 * `createNft()` flow so the marketplace has a queryable off-chain record.
 */
export async function createNft(req: Request, res: Response): Promise<void> {
  const parsed = createNftSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.errors[0]?.message ?? "Invalid payload");
  }
  const data = parsed.data;

  const creator = await upsertUser(data.wallet);
  const nft = await prisma.nft.create({
    data: {
      mint: data.mint,
      name: data.name,
      description: data.description,
      imageUri: data.imageUri,
      metadataUri: data.metadataUri,
      collection: data.collection,
      royaltyBps: data.royaltyBps,
      creatorId: creator.id,
      ownerWallet: data.wallet,
    },
  });

  await cacheDel("marketplace:listings");
  res.status(201).json(jsonSafe(nft));
}

/** Fetch a single NFT by mint address. */
export async function getNft(req: Request, res: Response): Promise<void> {
  const { mint } = req.params;
  const nft = await prisma.nft.findUnique({
    where: { mint },
    include: {
      creator: { select: { wallet: true } },
      listings: { where: { status: "ACTIVE" }, take: 1 },
    },
  });
  if (!nft) throw new ApiError(404, "NFT not found");
  res.json(jsonSafe(nft));
}

/** List NFTs owned by a wallet (portfolio). */
export async function getNftsByOwner(req: Request, res: Response): Promise<void> {
  const owner = req.query.owner as string | undefined;
  if (!owner || !isValidPublicKey(owner)) {
    throw new ApiError(400, "Valid ?owner address required");
  }
  const nfts = await prisma.nft.findMany({
    where: { ownerWallet: owner },
    orderBy: { createdAt: "desc" },
    include: { listings: { where: { status: "ACTIVE" }, take: 1 } },
  });
  res.json(jsonSafe(nfts));
}
