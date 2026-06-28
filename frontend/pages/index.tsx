import type { NextPage } from "next";
import Link from "next/link";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useWallet } from "@/hooks/useWallet";
import { NFTCard } from "@/components/NFTCard";

const Home: NextPage = () => {
  const { listings, loading } = useMarketplace({ sort: "latest" });
  const { address } = useWallet();

  return (
    <>
      <section className="hero">
        <h1>
          Mint. Trade. <span className="brand">Earn.</span>
        </h1>
        <p>
          PRISM is a decentralized NFT marketplace on Solana. Buy and sell NFTs,
          climb loyalty tiers, and earn SOL cashback on every trade.
        </p>
        <div className="row" style={{ justifyContent: "center", gap: 12 }}>
          <Link href="/marketplace" className="btn btn-primary">
            Explore Marketplace
          </Link>
          <Link href="/create" className="btn">
            Create an NFT
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="row between">
          <h2>Latest Listings</h2>
          <Link href="/marketplace" className="muted">
            View all →
          </Link>
        </div>
        {loading ? (
          <p className="muted">Loading listings…</p>
        ) : listings.length === 0 ? (
          <p className="muted">No NFTs listed yet. Be the first to create one!</p>
        ) : (
          <div className="grid">
            {listings.slice(0, 8).map((l) => (
              <NFTCard
                key={l.id}
                mint={l.nft.mint}
                name={l.nft.name}
                imageUri={l.nft.imageUri}
                collection={l.nft.collection}
                ownerWallet={l.nft.ownerWallet}
                priceSol={l.priceSol}
                connectedWallet={address}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
};

export default Home;
