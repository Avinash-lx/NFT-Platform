import { describe, expect, it } from "vitest";
import {
  Tier,
  feeBpsForPoints,
  nextTierProgress,
  pointsForPurchase,
  tierForPoints,
} from "../rewards/rewardsEngine";
import {
  cashbackAmount,
  daysHeld,
  evaluateEligibility,
} from "../cashback/cashbackEngine";

describe("rewardsEngine", () => {
  it("awards 10 points per SOL", () => {
    expect(pointsForPurchase(1)).toBe(10);
    expect(pointsForPurchase(2.5)).toBe(25);
    expect(pointsForPurchase(0)).toBe(0);
    expect(pointsForPurchase(-5)).toBe(0);
  });

  it("resolves tiers at thresholds", () => {
    expect(tierForPoints(0).tier).toBe(Tier.Bronze);
    expect(tierForPoints(499).tier).toBe(Tier.Bronze);
    expect(tierForPoints(500).tier).toBe(Tier.Silver);
    expect(tierForPoints(1999).tier).toBe(Tier.Silver);
    expect(tierForPoints(2000).tier).toBe(Tier.Gold);
    expect(tierForPoints(4999).tier).toBe(Tier.Gold);
    expect(tierForPoints(5000).tier).toBe(Tier.Diamond);
    expect(tierForPoints(999999).tier).toBe(Tier.Diamond);
  });

  it("maps tiers to marketplace fees", () => {
    expect(feeBpsForPoints(0)).toBe(250);
    expect(feeBpsForPoints(500)).toBe(200);
    expect(feeBpsForPoints(2000)).toBe(150);
    expect(feeBpsForPoints(5000)).toBe(100);
  });

  it("computes next-tier progress", () => {
    const p = nextTierProgress(250);
    expect(p?.next).toBe(Tier.Silver);
    expect(p?.pointsToNext).toBe(250);
    expect(p?.progressPct).toBe(50);
    expect(nextTierProgress(10000)).toBeNull();
  });
});

describe("cashbackEngine", () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  it("computes 5% cashback", () => {
    expect(cashbackAmount(10)).toBe(0.5);
    expect(cashbackAmount(0)).toBe(0);
  });

  it("counts holding days", () => {
    expect(daysHeld(daysAgo(8))).toBeGreaterThanOrEqual(7);
  });

  it("is eligible for Diamond held >= 7 days, unclaimed", () => {
    const result = evaluateEligibility({
      tier: Tier.Diamond,
      purchasedAt: daysAgo(8),
      alreadyClaimed: false,
      promotionActive: false,
      purchasePriceSol: 4,
    });
    expect(result.eligible).toBe(true);
    expect(result.amountSol).toBe(0.2);
  });

  it("rejects non-Diamond without promotion", () => {
    const result = evaluateEligibility({
      tier: Tier.Gold,
      purchasedAt: daysAgo(8),
      alreadyClaimed: false,
      promotionActive: false,
      purchasePriceSol: 4,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/Diamond/);
  });

  it("allows promotion to satisfy the tier condition", () => {
    const result = evaluateEligibility({
      tier: Tier.Bronze,
      purchasedAt: daysAgo(10),
      alreadyClaimed: false,
      promotionActive: true,
      purchasePriceSol: 2,
    });
    expect(result.eligible).toBe(true);
  });

  it("rejects when held < 7 days or already claimed", () => {
    expect(
      evaluateEligibility({
        tier: Tier.Diamond,
        purchasedAt: daysAgo(2),
        alreadyClaimed: false,
        promotionActive: false,
        purchasePriceSol: 2,
      }).eligible
    ).toBe(false);

    expect(
      evaluateEligibility({
        tier: Tier.Diamond,
        purchasedAt: daysAgo(20),
        alreadyClaimed: true,
        promotionActive: false,
        purchasePriceSol: 2,
      }).eligible
    ).toBe(false);
  });
});
