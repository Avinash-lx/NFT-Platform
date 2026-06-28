/**
 * Rewards engine — pure, side-effect-free loyalty calculations.
 *
 * Points: `purchase amount (SOL) × 10`.
 *
 * Tier thresholds:
 *   Bronze  → 0 – 499
 *   Silver  → 500 – 1,999
 *   Gold    → 2,000 – 4,999
 *   Diamond → 5,000+
 */

export enum Tier {
  Bronze = "BRONZE",
  Silver = "SILVER",
  Gold = "GOLD",
  Diamond = "DIAMOND",
}

export const POINTS_PER_SOL = 10;

export interface TierInfo {
  tier: Tier;
  /** Inclusive lower bound of the tier in points. */
  minPoints: number;
  /** Inclusive upper bound (null = unbounded). */
  maxPoints: number | null;
  /** Marketplace fee for the tier, in basis points. */
  feeBps: number;
  /** Whether the tier unlocks cashback. */
  cashbackEligible: boolean;
  /** Human-readable benefit summary. */
  benefits: string[];
}

export const TIERS: TierInfo[] = [
  {
    tier: Tier.Bronze,
    minPoints: 0,
    maxPoints: 499,
    feeBps: 250,
    cashbackEligible: false,
    benefits: ["Standard 2.5% fee"],
  },
  {
    tier: Tier.Silver,
    minPoints: 500,
    maxPoints: 1999,
    feeBps: 200,
    cashbackEligible: false,
    benefits: ["2.0% fee", "Early access"],
  },
  {
    tier: Tier.Gold,
    minPoints: 2000,
    maxPoints: 4999,
    feeBps: 150,
    cashbackEligible: false,
    benefits: ["1.5% fee", "Exclusive drops"],
  },
  {
    tier: Tier.Diamond,
    minPoints: 5000,
    maxPoints: null,
    feeBps: 100,
    cashbackEligible: true,
    benefits: ["1.0% fee", "Cashback eligible"],
  },
];

/** Points earned from a purchase priced in SOL. */
export function pointsForPurchase(priceSol: number): number {
  if (priceSol <= 0) return 0;
  return Math.floor(priceSol * POINTS_PER_SOL);
}

/** Resolve the tier for a given lifetime point total. */
export function tierForPoints(points: number): TierInfo {
  const safe = Math.max(0, Math.floor(points));
  // Iterate high → low and pick the first whose threshold is met.
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (safe >= TIERS[i].minPoints) return TIERS[i];
  }
  return TIERS[0];
}

/** Marketplace fee (bps) the user pays at their current tier. */
export function feeBpsForPoints(points: number): number {
  return tierForPoints(points).feeBps;
}

/**
 * Progress toward the next tier, for dashboard display.
 * Returns null when the user is already at the top tier.
 */
export function nextTierProgress(points: number): {
  next: Tier;
  pointsToNext: number;
  progressPct: number;
} | null {
  const current = tierForPoints(points);
  const idx = TIERS.findIndex((t) => t.tier === current.tier);
  if (idx >= TIERS.length - 1) return null;

  const next = TIERS[idx + 1];
  const span = next.minPoints - current.minPoints;
  const into = points - current.minPoints;
  return {
    next: next.tier,
    pointsToNext: Math.max(0, next.minPoints - points),
    progressPct: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100,
  };
}
