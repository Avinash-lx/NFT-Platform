import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, jsonSafe } from "../lib/http";
import { isValidPublicKey, lamportsToSol, solToLamports } from "../lib/solana";
import { cacheDel, cacheGet, cacheSet } from "../lib/redis";
import { creditPoints, upsertUser } from "../lib/users";
import { feeBpsForPoints, pointsForPurchase } from "../rewards/rewardsEngine";

/**
 * Browse listings with search / collection / price filters and sorting.
 * GET /marketplace?search=&collection=&minPrice=&maxPrice=&sort=
 */
export async function getListings(req: Request, res: Response): Promise<void> {
  const search = (req.query.search as string | undefined)?.trim();
  const collection = req.query.collection as string | undefined;
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
  const sort = (req.query.sort as string | undefined) ?? "latest";

  const cacheKey = `marketplace:listings:${JSON.stringify({
    search,
    collection,
    minPrice,
    maxPrice,
    sort,
  })}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const where: Prisma.ListingWhereInput = { status: "ACTIVE" };
  if (collection) where.nft = { collection };
  if (search) {
    where.nft = { ...(where.nft as object), name: { contains: search, mode: "insensitive" } };
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.priceLamports = {};
    if (minPrice !== undefined) where.priceLamports.gte = solToLamports(minPrice);
    if (maxPrice !== undefined) where.priceLamports.lte = solToLamports(maxPrice);
  }

  let orderBy: Prisma.ListingOrderByWithRelationInput;
  switch (sort) {
    case "price_asc":
      orderBy = { priceLamports: "asc" };
      break;
    case "price_desc":
      orderBy = { priceLamports: "desc" };
      break;
    default:
      orderBy = { createdAt: "desc" };
  }

  const listings = await prisma.listing.findMany({
    where,
    orderBy,
    include: { nft: true, seller: { select: { wallet: true } } },
  });

  const payload = jsonSafe(
    listings.map((l) => ({
      ...l,
      priceSol: lamportsToSol(l.priceLamports),
    }))
  );
  await cacheSet(cacheKey, payload, 30);
  res.json(payload);
}

const createListingSchema = z.object({
  mint: z.string().refine(isValidPublicKey, "Invalid mint"),
  priceSol: z.number().positive(),
  wallet: z.string().refine(isValidPublicKey, "Invalid wallet"),
});

/**
 * Record a new listing after the on-chain `list_nft` instruction succeeds.
 */
export async function createListing(req: Request, res: Response): Promise<void> {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.errors[0]?.message ?? "Invalid payload");
  }
  const { mint, priceSol, wallet } = parsed.data;

  const nft = await prisma.nft.findUnique({ where: { mint } });
  if (!nft) throw new ApiError(404, "NFT not found");
  if (nft.ownerWallet !== wallet) throw new ApiError(403, "Only the owner can list this NFT");

  const existing = await prisma.listing.findFirst({
    where: { nftId: nft.id, status: "ACTIVE" },
  });
  if (existing) throw new ApiError(409, "NFT already has an active listing");

  const seller = await upsertUser(wallet);
  const listing = await prisma.listing.create({
    data: {
      nftId: nft.id,
      sellerId: seller.id,
      priceLamports: solToLamports(priceSol),
    },
  });

  await cacheDel("marketplace:listings");
  res.status(201).json(jsonSafe(listing));
}

const cancelSchema = z.object({
  wallet: z.string().refine(isValidPublicKey, "Invalid wallet"),
});

/** Cancel an active listing after the on-chain `cancel_listing` succeeds. */
export async function cancelListing(req: Request, res: Response): Promise<void> {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload");

  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { seller: true },
  });
  if (!listing || listing.status !== "ACTIVE") throw new ApiError(404, "Active listing not found");
  if (listing.seller.wallet !== parsed.data.wallet) {
    throw new ApiError(403, "Only the seller can cancel this listing");
  }

  await prisma.listing.update({
    where: { id: listing.id },
    data: { status: "CANCELLED" },
  });

  await cacheDel("marketplace:listings");
  res.json({ ok: true });
}

const buySchema = z.object({
  listingId: z.string(),
  buyerWallet: z.string().refine(isValidPublicKey, "Invalid wallet"),
  signature: z.string().optional(),
});

/**
 * Index a purchase after the on-chain `buy_nft` instruction confirms: mark the
 * listing sold, transfer ownership, and record the purchase + fee.
 *
 * Loyalty points are credited ON-CHAIN by `buy_nft` (CPI into the rewards
 * program); the value mirrored here is a cache for dashboard display using the
 * same formula (floor(priceSol × 10)), not the source of truth.
 */
export async function buyNft(req: Request, res: Response): Promise<void> {
  const parsed = buySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload");
  const { listingId, buyerWallet, signature } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      include: { nft: true, seller: true },
    });
    if (!listing || listing.status !== "ACTIVE") {
      throw new ApiError(404, "Active listing not found");
    }
    if (listing.seller.wallet === buyerWallet) {
      throw new ApiError(400, "You cannot buy your own NFT");
    }

    const buyer = await upsertUser(buyerWallet, tx);

    // Fee is computed from the buyer's tier at sale time.
    const feeBps = feeBpsForPoints(buyer.points);
    const price = listing.priceLamports;
    const fee = (price * BigInt(feeBps)) / BigInt(10000);

    await tx.listing.update({ where: { id: listing.id }, data: { status: "SOLD" } });
    await tx.nft.update({ where: { id: listing.nftId }, data: { ownerWallet: buyerWallet } });

    const priceSol = lamportsToSol(price);
    const points = pointsForPurchase(priceSol);

    const purchase = await tx.purchase.create({
      data: {
        nftId: listing.nftId,
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        priceLamports: price,
        feeLamports: fee,
        pointsEarned: points,
        signature,
      },
    });

    await creditPoints(tx, buyer.id, points, `Purchase of ${listing.nft.name}`);

    return { purchase, points };
  });

  await cacheDel("marketplace:listings");
  res.status(201).json(jsonSafe(result));
}
