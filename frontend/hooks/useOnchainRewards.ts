import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  OnchainCashbackClaim,
  TierName,
  getCashbackClaims,
  getRewardPoints,
  nextTierProgress,
  onchainAvailable,
  tierForPoints,
} from "@/services/rewardsChain";

export interface OnchainRewards {
  points: number;
  tier: TierName;
  feeBps: number;
  cashbackEligible: boolean;
  benefits: string[];
  nextTier: { next: TierName; pointsToNext: number; progressPct: number } | null;
  cashbackClaims: OnchainCashbackClaim[];
  cashbackEarnedSol: number;
}

/**
 * Reads loyalty points/tier and cashback claims directly from the chain. Returns
 * `null` (available=false) when the rewards program isn't deployed, so callers
 * can fall back to the backend mirror.
 */
export function useOnchainRewards(wallet: string | null) {
  const [data, setData] = useState<OnchainRewards | null>(null);
  const [loading, setLoading] = useState(false);
  const available = onchainAvailable();

  const refresh = useCallback(async () => {
    if (!wallet || !available) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const user = new PublicKey(wallet);
      const [points, claims] = await Promise.all([
        getRewardPoints(user),
        getCashbackClaims(user),
      ]);
      const tier = tierForPoints(points);
      setData({
        points,
        tier: tier.tier,
        feeBps: tier.feeBps,
        cashbackEligible: tier.cashbackEligible,
        benefits: tier.benefits,
        nextTier: nextTierProgress(points),
        cashbackClaims: claims,
        cashbackEarnedSol: claims.reduce((s, c) => s + c.amountSol, 0),
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [wallet, available]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, available, refresh };
}
