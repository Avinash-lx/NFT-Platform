/**
 * Cashback engine — pure eligibility and amount calculations.
 *
 * Eligibility conditions (all must hold):
 *   1. Diamond tier OR an active promotion
 *   2. NFT held for >= 7 days after purchase
 *   3. Cashback not already claimed for this NFT
 *
 * Amount: 5% of the original purchase price.
 */

import { Tier } from "../rewards/rewardsEngine";

export const CASHBACK_PERCENT = 5;
export const MIN_HOLDING_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CashbackContext {
  tier: Tier;
  /** When the NFT was purchased. */
  purchasedAt: Date;
  /** Whether the user already claimed cashback for this NFT. */
  alreadyClaimed: boolean;
  /** Whether a global/user promotion is currently active. */
  promotionActive: boolean;
  /** Original purchase price in SOL. */
  purchasePriceSol: number;
  /** Evaluation time (defaults to now). */
  now?: Date;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  amountSol: number;
}

/** Whole days elapsed between two dates. */
export function daysHeld(purchasedAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - purchasedAt.getTime()) / MS_PER_DAY);
}

/** Cashback amount in SOL for a given purchase price. */
export function cashbackAmount(purchasePriceSol: number): number {
  if (purchasePriceSol <= 0) return 0;
  return (purchasePriceSol * CASHBACK_PERCENT) / 100;
}

/** Evaluate cashback eligibility, collecting any failing reasons. */
export function evaluateEligibility(ctx: CashbackContext): EligibilityResult {
  const now = ctx.now ?? new Date();
  const reasons: string[] = [];

  if (ctx.tier !== Tier.Diamond && !ctx.promotionActive) {
    reasons.push("Requires Diamond tier or an active promotion");
  }

  const held = daysHeld(ctx.purchasedAt, now);
  if (held < MIN_HOLDING_DAYS) {
    reasons.push(
      `NFT must be held for ${MIN_HOLDING_DAYS} days (held ${held})`
    );
  }

  if (ctx.alreadyClaimed) {
    reasons.push("Cashback already claimed for this NFT");
  }

  const eligible = reasons.length === 0;
  return {
    eligible,
    reasons,
    amountSol: eligible ? cashbackAmount(ctx.purchasePriceSol) : 0,
  };
}
