/**
 * Dashboard analytics aggregation.
 *
 * Produces the stats panel and chart series consumed by /dashboard:
 *   - Monthly purchases (bar)
 *   - Sales analytics (line)
 *   - Reward points growth (area)
 *   - Cashback history (timeline)
 */

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "../lib/prisma";
import { connection, lamportsToSol } from "../lib/solana";
import { PublicKey } from "@solana/web3.js";
import { nextTierProgress, tierForPoints } from "../rewards/rewardsEngine";

export interface DashboardStats {
  walletBalanceSol: number;
  nftsOwned: number;
  nftsListed: number;
  totalPurchasesSol: number;
  totalSalesSol: number;
  points: number;
  tier: string;
  cashbackEarnedSol: number;
  portfolioValueSol: number;
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  value: number;
}

export interface DashboardPayload {
  stats: DashboardStats;
  charts: {
    monthlyPurchases: MonthlyPoint[];
    salesAnalytics: MonthlyPoint[];
    pointsGrowth: { month: string; cumulative: number }[];
    cashbackHistory: { date: string; amountSol: number; mint: string }[];
  };
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Bucket a list of { createdAt, valueSol } into per-month sums. */
function bucketByMonth(rows: { createdAt: Date; valueSol: number }[]): MonthlyPoint[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = monthKey(r.createdAt);
    map.set(key, (map.get(key) ?? 0) + r.valueSol);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value: Number(value.toFixed(4)) }));
}

/** Live SOL balance for a wallet (0 on RPC failure). */
async function getWalletBalance(wallet: string): Promise<number> {
  try {
    const lamports = await connection.getBalance(new PublicKey(wallet));
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

/** Build the full dashboard payload for a wallet. */
export async function getDashboard(wallet: string): Promise<DashboardPayload> {
  const user = await prisma.user.upsert({
    where: { wallet },
    update: {},
    create: { wallet },
  });

  const [
    walletBalanceSol,
    nftsOwned,
    nftsListed,
    purchases,
    sales,
    cashbackClaims,
    rewardEvents,
    ownedNfts,
  ] = await Promise.all([
    getWalletBalance(wallet),
    prisma.nft.count({ where: { ownerWallet: wallet } }),
    prisma.listing.count({ where: { sellerId: user.id, status: "ACTIVE" } }),
    prisma.purchase.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.purchase.findMany({ where: { sellerId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.cashbackClaim.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.rewardEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.nft.findMany({
      where: { ownerWallet: wallet },
      include: { listings: { where: { status: "ACTIVE" }, take: 1 } },
    }),
  ]);

  const totalPurchasesSol = purchases.reduce((s, p) => s + lamportsToSol(p.priceLamports), 0);
  const totalSalesSol = sales.reduce(
    (s, p) => s + lamportsToSol(p.priceLamports - p.feeLamports),
    0
  );
  const cashbackEarnedSol = cashbackClaims.reduce(
    (s, c) => s + lamportsToSol(c.amountLamports),
    0
  );

  // Portfolio value: floor = each owned NFT's active listing price, else 0.
  const portfolioValueSol = ownedNfts.reduce(
    (s, nft) => s + (nft.listings[0] ? lamportsToSol(nft.listings[0].priceLamports) : 0),
    0
  );

  // Cumulative points growth by month.
  const growthMap = new Map<string, number>();
  let cumulative = 0;
  for (const e of rewardEvents) {
    cumulative += e.points;
    growthMap.set(monthKey(e.createdAt), cumulative);
  }

  return {
    stats: {
      walletBalanceSol: Number(walletBalanceSol.toFixed(4)),
      nftsOwned,
      nftsListed,
      totalPurchasesSol: Number(totalPurchasesSol.toFixed(4)),
      totalSalesSol: Number(totalSalesSol.toFixed(4)),
      points: user.points,
      tier: tierForPoints(user.points).tier,
      cashbackEarnedSol: Number(cashbackEarnedSol.toFixed(4)),
      portfolioValueSol: Number(portfolioValueSol.toFixed(4)),
    },
    charts: {
      monthlyPurchases: bucketByMonth(
        purchases.map((p) => ({ createdAt: p.createdAt, valueSol: lamportsToSol(p.priceLamports) }))
      ),
      salesAnalytics: bucketByMonth(
        sales.map((p) => ({ createdAt: p.createdAt, valueSol: lamportsToSol(p.priceLamports) }))
      ),
      pointsGrowth: [...growthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, c]) => ({ month, cumulative: c })),
      cashbackHistory: cashbackClaims.map((c) => ({
        date: c.createdAt.toISOString(),
        amountSol: lamportsToSol(c.amountLamports),
        mint: c.mint,
      })),
    },
  };
}

// Re-exported so callers can show tier progress alongside the dashboard.
export { nextTierProgress };
