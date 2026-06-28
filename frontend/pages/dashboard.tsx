import type { NextPage } from "next";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useRewards } from "@/hooks/useRewards";
import { useNFTs } from "@/hooks/useNFTs";
import { api } from "@/services/api";
import { DashboardCharts, DashboardChartsData } from "@/components/DashboardCharts";
import { RewardBadge } from "@/components/RewardBadge";
import { ListingModal } from "@/components/ListingModal";
import { NFTCard } from "@/components/NFTCard";
import { formatSol, bpsToPercent } from "@/lib/format";

interface DashboardResponse {
  stats: {
    walletBalanceSol: number;
    nftsOwned: number;
    nftsListed: number;
    totalPurchasesSol: number;
    totalSalesSol: number;
    points: number;
    tier: string;
    cashbackEarnedSol: number;
    portfolioValueSol: number;
  };
  charts: DashboardChartsData;
}

const Stat = ({ value, label }: { value: string | number; label: string }) => (
  <div className="stat">
    <div className="value">{value}</div>
    <div className="label">{label}</div>
  </div>
);

const DashboardPage: NextPage = () => {
  const { address, connected } = useWallet();
  const { rewards } = useRewards(address);
  const { nfts, refresh: refreshNfts } = useNFTs(address);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [listing, setListing] = useState<{ mint: string; name: string } | null>(null);

  useEffect(() => {
    if (!address) {
      setData(null);
      return;
    }
    api
      .getDashboard(address)
      .then((d) => setData(d as DashboardResponse))
      .catch(() => setData(null));
  }, [address]);

  if (!connected) {
    return (
      <section className="section">
        <h1>Dashboard</h1>
        <p className="muted">Connect your wallet to view your portfolio and analytics.</p>
      </section>
    );
  }

  const s = data?.stats;

  return (
    <section className="section">
      <div className="row between">
        <h1>Dashboard</h1>
        {rewards && <RewardBadge tier={rewards.tier} points={rewards.points} />}
      </div>

      <div className="stats" style={{ margin: "20px 0" }}>
        <Stat value={s ? formatSol(s.walletBalanceSol) : "—"} label="Wallet Balance" />
        <Stat value={s?.nftsOwned ?? "—"} label="NFTs Owned" />
        <Stat value={s?.nftsListed ?? "—"} label="NFTs Listed" />
        <Stat value={s ? formatSol(s.totalPurchasesSol) : "—"} label="Total Purchases" />
        <Stat value={s ? formatSol(s.totalSalesSol) : "—"} label="Total Sales" />
        <Stat value={s ? formatSol(s.cashbackEarnedSol) : "—"} label="Cashback Earned" />
        <Stat value={s ? formatSol(s.portfolioValueSol) : "—"} label="Portfolio Value" />
        <Stat
          value={rewards ? `${rewards.points.toLocaleString()} pts` : "—"}
          label={rewards ? `${rewards.tier} · ${bpsToPercent(rewards.feeBps)} fee` : "Rewards"}
        />
      </div>

      {rewards?.nextTier && (
        <p className="muted">
          {rewards.nextTier.pointsToNext.toLocaleString()} pts to {rewards.nextTier.next} (
          {rewards.nextTier.progressPct}% there)
        </p>
      )}

      {data && (
        <div className="section">
          <h2>Analytics</h2>
          <DashboardCharts data={data.charts} />
        </div>
      )}

      <div className="section">
        <h2>Your NFTs</h2>
        {nfts.length === 0 ? (
          <p className="muted">You don’t own any NFTs yet.</p>
        ) : (
          <div className="grid">
            {nfts.map((nft) => {
              const active = nft.listings?.[0];
              return (
                <div key={nft.id}>
                  <NFTCard
                    mint={nft.mint}
                    name={nft.name}
                    imageUri={nft.imageUri}
                    collection={nft.collection}
                    ownerWallet={nft.ownerWallet}
                  />
                  {!active && (
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 8, width: "100%" }}
                      onClick={() => setListing({ mint: nft.mint, name: nft.name })}
                    >
                      List for sale
                    </button>
                  )}
                  {active && <p className="muted" style={{ marginTop: 8 }}>Listed</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {listing && (
        <ListingModal
          mint={listing.mint}
          name={listing.name}
          onClose={() => setListing(null)}
          onListed={refreshNfts}
        />
      )}
    </section>
  );
};

export default DashboardPage;
