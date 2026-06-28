import { Request, Response } from "express";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, jsonSafe } from "../lib/http";
import { isValidPublicKey, loadTreasuryKeypair } from "../lib/solana";
import { payCashbackOnChain } from "../lib/cashbackProgram";
import { tierForPoints } from "../rewards/rewardsEngine";
import { evaluateEligibility } from "../cashback/cashbackEngine";
import { config } from "../config";

/**
 * Build the cashback context for a purchase: resolve the buyer's tier, whether
 * they already claimed, holding time, and original price.
 */
async function buildContext(purchaseId: string, promotionActive: boolean) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { buyer: true, nft: true, cashbackClaim: true },
  });
  if (!purchase) throw new ApiError(404, "Purchase not found");

  const tier = tierForPoints(purchase.buyer.points).tier;
  const purchasePriceSol = Number(purchase.priceLamports) / LAMPORTS_PER_SOL;

  return {
    purchase,
    ctx: {
      tier,
      purchasedAt: purchase.createdAt,
      alreadyClaimed: purchase.cashbackClaim !== null,
      promotionActive,
      purchasePriceSol,
    },
  };
}

/** GET /cashback/eligibility/:purchaseId — preview eligibility without paying. */
export async function checkEligibility(req: Request, res: Response): Promise<void> {
  const promotionActive = req.query.promotion === "true";
  const { ctx } = await buildContext(req.params.purchaseId, promotionActive);
  res.json(jsonSafe(evaluateEligibility(ctx)));
}

const requestSchema = z.object({
  purchaseId: z.string(),
  wallet: z.string().refine(isValidPublicKey, "Invalid wallet"),
  promotionActive: z.boolean().optional(),
});

/**
 * POST /cashback/request — verify eligibility off-chain, then settle 5%
 * **on-chain** via `cashback_program.request_cashback`. The program records the
 * claim PDA (single-claim per user+mint) and transfers from the treasury PDA;
 * the backend mirrors the result in the DB for indexing.
 */
export async function requestCashback(req: Request, res: Response): Promise<void> {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid payload");
  const { purchaseId, wallet, promotionActive } = parsed.data;

  const { purchase, ctx } = await buildContext(purchaseId, promotionActive ?? false);
  if (purchase.buyer.wallet !== wallet) {
    throw new ApiError(403, "Wallet does not own this purchase");
  }

  const eligibility = evaluateEligibility(ctx);
  if (!eligibility.eligible) {
    throw new ApiError(400, `Not eligible: ${eligibility.reasons.join("; ")}`);
  }

  // Settle on-chain through the cashback program (computes 5% itself).
  let signature: string | undefined;
  let amountLamports = BigInt(Math.round(eligibility.amountSol * LAMPORTS_PER_SOL));
  const treasury = loadTreasuryKeypair();
  if (treasury) {
    try {
      const result = await payCashbackOnChain(
        wallet,
        purchase.nft.mint,
        BigInt(purchase.priceLamports.toString())
      );
      signature = result.signature;
      amountLamports = result.amountLamports;
    } catch (err) {
      throw new ApiError(502, `On-chain cashback failed: ${(err as Error).message}`);
    }
  } else if (config.env === "production") {
    throw new ApiError(500, "Treasury wallet not configured");
  }

  const claim = await prisma.cashbackClaim.create({
    data: {
      userId: purchase.buyerId,
      purchaseId: purchase.id,
      mint: purchase.nft.mint,
      amountLamports,
      signature,
    },
  });

  res.status(201).json(jsonSafe({ claim, amountSol: eligibility.amountSol, signature }));
}
