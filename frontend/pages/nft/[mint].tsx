import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/services/api";
import { buyNftOnChain } from "@/services/marketplace";
import { useWallet } from "@/hooks/useWallet";
import { ipfsToHttp } from "@/services/ipfs";
import { truncateAddress, formatSol, bpsToPercent, lamportsToSol } from "@/lib/format";
import { solscanAddress, MARKETPLACE_FEE_BPS } from "@/lib/constants";

interface NftDetail {
  id: string;
  mint: string;
  name: string;
  description?: string;
  imageUri: string;
  collection?: string;
  royaltyBps: number;
  ownerWallet: string;
  creator: { wallet: string };
  listings: { id: string; priceLamports: string }[];
}

const NftDetailPage: NextPage = () => {
  const router = useRouter();
  const { mint } = router.query;
  const wallet = useWallet();
  const [nft, setNft] = useState<NftDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof mint !== "string") return;
    api
      .getNft(mint)
      .then((d) => setNft(d as NftDetail))
      .catch((e) => setError((e as Error).message));
  }, [mint]);

  if (error) return <p className="muted section">{error}</p>;
  if (!nft) return <p className="muted section">Loading…</p>;

  const listing = nft.listings?.[0];
  const priceSol = listing ? lamportsToSol(Number(listing.priceLamports)) : undefined;
  const isOwner = wallet.address === nft.ownerWallet;

  async function buy() {
    if (!listing || priceSol === undefined) return;
    if (!wallet.authSigner || !wallet.address) {
      toast.error("Connect your wallet");
      return;
    }
    const fee = (priceSol * MARKETPLACE_FEE_BPS) / 10000;
    if (
      !window.confirm(
        `Buy for ${formatSol(priceSol)}? (${formatSol(fee)} marketplace fee is deducted from the sale)`
      )
    )
      return;

    const id = toast.loading("Sending transaction…");
    try {
      // On-chain settlement first, then record off-chain with the signature.
      const signature = await buyNftOnChain(wallet, nft!.mint, nft!.ownerWallet);
      toast.loading("Recording purchase…", { id });
      await api.buyNft(
        { listingId: listing.id, buyerWallet: wallet.address, signature },
        wallet.authSigner
      );
      toast.success("Purchased!", { id });
      const updated = (await api.getNft(nft!.mint)) as NftDetail;
      setNft(updated);
    } catch (e) {
      toast.error((e as Error).message, { id });
    }
  }

  return (
    <section className="section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ipfsToHttp(nft.imageUri)} alt={nft.name} className="card-img" style={{ borderRadius: 14 }} />
      <div>
        <h1 style={{ marginTop: 0 }}>{nft.name}</h1>
        {nft.collection && <span className="badge">{nft.collection}</span>}
        <p style={{ marginTop: 16 }}>{nft.description}</p>

        <div className="stat" style={{ margin: "16px 0" }}>
          <div className="value">{priceSol !== undefined ? formatSol(priceSol) : "Not listed"}</div>
          <div className="label">Current price</div>
        </div>

        <p className="muted">Owner: {truncateAddress(nft.ownerWallet)}</p>
        <p className="muted">Creator: {truncateAddress(nft.creator.wallet)}</p>
        <p className="muted">Royalty: {bpsToPercent(nft.royaltyBps)}</p>
        <p className="muted">
          <a href={solscanAddress(nft.mint)} target="_blank" rel="noreferrer">
            View mint on Solscan ↗
          </a>
        </p>

        {listing && (
          <button className="btn btn-primary" disabled={isOwner} onClick={buy} style={{ marginTop: 12 }}>
            {isOwner ? "You own this" : "Buy now"}
          </button>
        )}
      </div>
    </section>
  );
};

export default NftDetailPage;
