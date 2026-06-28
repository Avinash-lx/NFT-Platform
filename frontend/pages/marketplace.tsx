import type { NextPage } from "next";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMarketplace, MarketplaceFilters } from "@/hooks/useMarketplace";
import { useWallet } from "@/hooks/useWallet";
import { NFTCard } from "@/components/NFTCard";
import { api } from "@/services/api";
import { buyNftOnChain } from "@/services/marketplace";
import { bpsToPercent, formatSol } from "@/lib/format";
import { MARKETPLACE_FEE_BPS } from "@/lib/constants";

const MarketplacePage: NextPage = () => {
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState("");
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [sort, setSort] = useState<MarketplaceFilters["sort"]>("latest");

  const filters = useMemo<MarketplaceFilters>(
    () => ({ search, collection: collection || undefined, maxPrice, sort }),
    [search, collection, maxPrice, sort]
  );

  const { listings, loading, refresh } = useMarketplace(filters);
  const wallet = useWallet();

  const collections = useMemo(
    () => Array.from(new Set(listings.map((l) => l.nft.collection).filter(Boolean))) as string[],
    [listings]
  );

  async function confirmAndBuy(listing: {
    id: string;
    priceSol: number;
    nft: { mint: string };
    seller: { wallet: string };
  }) {
    if (!wallet.authSigner || !wallet.address) {
      toast.error("Connect your wallet to buy");
      return;
    }
    const { priceSol } = listing;
    const fee = (priceSol * MARKETPLACE_FEE_BPS) / 10000;
    const ok = window.confirm(
      `Buy this NFT?\n\nYou pay: ${formatSol(priceSol)}\nMarketplace fee (${bpsToPercent(
        MARKETPLACE_FEE_BPS
      )}, deducted from sale): ${formatSol(fee)}\nSeller receives: ${formatSol(priceSol - fee)}`
    );
    if (!ok) return;

    const id = toast.loading("Sending transaction…");
    try {
      // 1. On-chain: marketplace_program.buy_nft() transfers SOL (minus fee) +
      //    the NFT from escrow to the buyer.
      const signature = await buyNftOnChain(wallet, listing.nft.mint, listing.seller.wallet);
      // 2. Off-chain: settle ownership + reward points.
      toast.loading("Recording purchase…", { id });
      const res = (await api.buyNft(
        { listingId: listing.id, buyerWallet: wallet.address, signature },
        wallet.authSigner
      )) as { points: number };
      toast.success(`Purchased! +${res.points} reward points`, { id });
      void refresh();
    } catch (e) {
      toast.error((e as Error).message || "Purchase failed", { id });
    }
  }

  return (
    <section className="section">
      <h1>Marketplace</h1>

      <div className="row" style={{ flexWrap: "wrap", gap: 12, margin: "16px 0 24px" }}>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select"
          style={{ maxWidth: 200 }}
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ maxWidth: 180 }}
          type="number"
          min={0}
          placeholder="Max price (SOL)"
          value={maxPrice ?? ""}
          onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
        />
        <select
          className="select"
          style={{ maxWidth: 200 }}
          value={sort}
          onChange={(e) => setSort(e.target.value as MarketplaceFilters["sort"])}
        >
          <option value="latest">Latest</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="muted">No listings match your filters.</p>
      ) : (
        <div className="grid">
          {listings.map((l) => (
            <NFTCard
              key={l.id}
              mint={l.nft.mint}
              name={l.nft.name}
              imageUri={l.nft.imageUri}
              collection={l.nft.collection}
              ownerWallet={l.nft.ownerWallet}
              priceSol={l.priceSol}
              connectedWallet={wallet.address}
              onBuy={() => confirmAndBuy(l)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default MarketplacePage;
