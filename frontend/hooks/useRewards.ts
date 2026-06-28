import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

export type TierName = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";

export interface RewardsDto {
  wallet: string;
  points: number;
  tier: TierName;
  feeBps: number;
  cashbackEligible: boolean;
  benefits: string[];
  nextTier: { next: TierName; pointsToNext: number; progressPct: number } | null;
  history: { id: string; points: number; reason: string; createdAt: string }[];
}

/** Load a wallet's loyalty rewards summary. */
export function useRewards(wallet: string | null) {
  const [rewards, setRewards] = useState<RewardsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) {
      setRewards(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRewards((await api.getRewards(wallet)) as RewardsDto);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rewards, loading, error, refresh };
}
