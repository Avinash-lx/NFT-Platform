import { Request, Response } from "express";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, jsonSafe } from "../lib/http";
import { connection, isValidPublicKey, loadTreasuryKeypair } from "../lib/solana";
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
 * POST /cashback/request — verify eligibility, pay 5% from the treasury wallet,
 * and record the claim. The unique (userId, mint) constraint prevents
 * double-claims even under concurrent requests.
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

  const amountLamports = BigInt(Math.round(eligibility.amountSol * LAMPORTS_PER_SOL));

  // Pay out from the treasury if a key is configured (devnet/mainnet); otherwise
  // record the claim without an on-chain signature for local development.
  let signature: string | undefined;
  const treasury = loadTreasuryKeypair();
  if (treasury) {
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: treasury.publicKey,
          toPubkey: new PublicKey(wallet),
          lamports: Number(amountLamports),
        })
      );
      signature = await sendAndConfirmTransaction(connection, tx, [treasury]);
    } catch (err) {
      throw new ApiError(502, `Treasury transfer failed: ${(err as Error).message}`);
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
