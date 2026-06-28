import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError, jsonSafe } from "../lib/http";
import { isValidPublicKey } from "../lib/solana";
import { upsertUser } from "../lib/users";
import { nextTierProgress, tierForPoints } from "../rewards/rewardsEngine";

/**
 * Return a wallet's loyalty summary: points, tier, fee, benefits, progress to
 * the next tier, and recent reward ledger events.
 * GET /rewards/:wallet
 */
export async function getRewards(req: Request, res: Response): Promise<void> {
  const { wallet } = req.params;
  if (!isValidPublicKey(wallet)) throw new ApiError(400, "Invalid wallet address");

  const user = await upsertUser(wallet);
  const tierInfo = tierForPoints(user.points);
  const progress = nextTierProgress(user.points);

  const history = await prisma.rewardEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json(
    jsonSafe({
      wallet,
      points: user.points,
      tier: tierInfo.tier,
      feeBps: tierInfo.feeBps,
      cashbackEligible: tierInfo.cashbackEligible,
      benefits: tierInfo.benefits,
      nextTier: progress,
      history,
    })
  );
}

/** Leaderboard: top wallets by lifetime points. GET /rewards */
export async function getLeaderboard(_req: Request, res: Response): Promise<void> {
  const top = await prisma.user.findMany({
    orderBy: { points: "desc" },
    take: 25,
    select: { wallet: true, points: true, tier: true },
  });
  res.json(jsonSafe(top));
}
