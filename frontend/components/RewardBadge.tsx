import { FC } from "react";
import type { TierName } from "@/hooks/useRewards";

const TIER_ICON: Record<TierName, string> = {
  BRONZE: "🥉",
  SILVER: "🥈",
  GOLD: "🥇",
  DIAMOND: "💎",
};

/** Coloured tier chip used across the dashboard and nav. */
export const RewardBadge: FC<{ tier: TierName; points?: number }> = ({ tier, points }) => (
  <span className={`badge tier-${tier}`}>
    {TIER_ICON[tier]} {tier}
    {points !== undefined ? ` · ${points.toLocaleString()} pts` : ""}
  </span>
);
