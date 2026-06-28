import { Prisma, Tier as PrismaTier, User } from "@prisma/client";
import { prisma } from "./prisma";
import { Tier, tierForPoints } from "../rewards/rewardsEngine";

/** Ensure a User row exists for a wallet, returning it. */
export async function upsertUser(
  wallet: string,
  tx: Prisma.TransactionClient = prisma
): Promise<User> {
  return tx.user.upsert({
    where: { wallet },
    update: {},
    create: { wallet },
  });
}

/** Map the engine Tier enum to the Prisma Tier enum (same string values). */
export function toPrismaTier(tier: Tier): PrismaTier {
  return tier as unknown as PrismaTier;
}

/**
 * Credit loyalty points to a user inside a transaction: append a ledger event,
 * bump the running total, and recompute the cached tier.
 */
export async function creditPoints(
  tx: Prisma.TransactionClient,
  userId: string,
  points: number,
  reason: string
): Promise<User> {
  if (points > 0) {
    await tx.rewardEvent.create({ data: { userId, points, reason } });
  }
  const updated = await tx.user.update({
    where: { id: userId },
    data: { points: { increment: points } },
  });
  const tier = toPrismaTier(tierForPoints(updated.points).tier);
  if (tier !== updated.tier) {
    return tx.user.update({ where: { id: userId }, data: { tier } });
  }
  return updated;
}
