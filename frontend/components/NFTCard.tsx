import { FC } from "react";
import Link from "next/link";
import { ipfsToHttp } from "@/services/ipfs";
import { truncateAddress, formatSol } from "@/lib/format";

export interface NFTCardProps {
  mint: string;
  name: string;
  imageUri: string;
  collection?: string;
  ownerWallet: string;
  priceSol?: number;
  /** Connected wallet — used to disable Buy on owned NFTs. */
  connectedWallet?: string | null;
  onBuy?: () => void;
}

/** Marketplace / portfolio NFT tile. */
export const NFTCard: FC<NFTCardProps> = ({
  mint,
  name,
  imageUri,
  collection,
  ownerWallet,
  priceSol,
  connectedWallet,
  onBuy,
}) => {
  const isOwner = connectedWallet === ownerWallet;

  return (
    <div className="card">
      <Link href={`/nft/${mint}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="card-img" src={ipfsToHttp(imageUri)} alt={name} />
      </Link>
      <div className="card-body">
        <div className="row between">
          <h3 className="card-title">{name}</h3>
          {collection && <span className="badge">{collection}</span>}
        </div>
        <p className="muted">Owner {truncateAddress(ownerWallet)}</p>

        <div className="row between" style={{ marginTop: 12 }}>
          <strong>{priceSol !== undefined ? formatSol(priceSol) : "Not listed"}</strong>
          {onBuy && priceSol !== undefined && (
            <button
              className="btn btn-primary"
              disabled={isOwner}
              onClick={onBuy}
              title={isOwner ? "You own this NFT" : "Buy"}
            >
              {isOwner ? "Owned" : "Buy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
