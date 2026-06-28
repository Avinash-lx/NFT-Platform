import { FC, useState } from "react";
import toast from "react-hot-toast";
import { useWallet } from "@/hooks/useWallet";
import { api } from "@/services/api";
import { listNftOnChain } from "@/services/marketplace";
import { solToLamports } from "@/lib/format";

interface ListingModalProps {
  mint: string;
  name: string;
  onClose: () => void;
  onListed?: () => void;
}

/**
 * Modal for listing an owned NFT. The on-chain `list_nft` instruction (which
 * locks the NFT in the escrow PDA owned by the listing PDA) executes first; on
 * confirmation the listing is recorded in the backend with the tx signature.
 */
export const ListingModal: FC<ListingModalProps> = ({ mint, name, onClose, onListed }) => {
  const wallet = useWallet();
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onList() {
    const priceSol = Number(price);
    if (!Number.isFinite(priceSol) || priceSol <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    if (!wallet.authSigner || !wallet.address) {
      toast.error("Connect your wallet");
      return;
    }

    setSubmitting(true);
    const id = toast.loading("Locking NFT in escrow…");
    try {
      // 1. On-chain: marketplace_program.list_nft(price) → escrow PDA.
      await listNftOnChain(wallet, mint, solToLamports(priceSol));
      // 2. Off-chain: record the listing.
      toast.loading("Recording listing…", { id });
      await api.createListing({ mint, priceSol, wallet: wallet.address }, wallet.authSigner);
      toast.success("NFT listed!", { id });
      onListed?.();
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Listing failed", { id });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>List “{name}” for sale</h3>
        <div className="field">
          <label>Price (SOL)</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="1.5"
          />
        </div>
        <div className="row between">
          <button className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onList} disabled={submitting}>
            {submitting ? "Listing…" : "Confirm Listing"}
          </button>
        </div>
      </div>
    </div>
  );
};
