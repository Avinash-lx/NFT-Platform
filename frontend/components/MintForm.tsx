import { FC, FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { useWallet } from "@/hooks/useWallet";
import { uploadImage, uploadMetadata, ipfsToHttp } from "@/services/ipfs";
import { mintNftOnChain } from "@/services/nft";
import { api } from "@/services/api";
import { solscanAddress } from "@/lib/constants";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED = ["image/png", "image/jpeg", "image/gif"];

/** NFT creation form implementing the full mint workflow. */
export const MintForm: FC = () => {
  const wallet = useWallet();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [collection, setCollection] = useState("");
  const [royaltyPct, setRoyaltyPct] = useState(5);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      toast.error("Image must be PNG, JPG, or GIF");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be 10MB or smaller");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  function validate(): string | null {
    if (!wallet.connected || !wallet.address) return "Connect your wallet first";
    if (!name.trim() || name.length > 32) return "Name is required (max 32 chars)";
    if (!file) return "An image is required";
    if (royaltyPct < 0 || royaltyPct > 100) return "Royalty must be between 0 and 100%";
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!wallet.authSigner || !wallet.address) return;

    setSubmitting(true);
    const toastId = toast.loading("Uploading image to IPFS…");
    try {
      // 1. Image → IPFS
      const imageUri = await uploadImage(file!);

      // 2. Build + upload metadata JSON
      toast.loading("Uploading metadata…", { id: toastId });
      const metadataUri = await uploadMetadata({
        name,
        description,
        image: imageUri,
        attributes: collection ? [{ trait_type: "Collection", value: collection }] : [],
      });

      // 3. Mint on-chain via the PRISM nft_program (CPIs into Token Metadata).
      toast.loading("Minting NFT on Solana…", { id: toastId });
      const royaltyBps = Math.round(royaltyPct * 100);
      const symbol = (collection || name).slice(0, 10).toUpperCase();
      const { mint } = await mintNftOnChain(wallet, {
        name,
        symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: royaltyBps,
      });

      // 4. Persist to backend
      await api.createNft(
        {
          mint,
          name,
          description,
          imageUri,
          metadataUri,
          collection: collection || undefined,
          royaltyBps,
          wallet: wallet.address,
        },
        wallet.authSigner
      );

      toast.success(
        (t) => (
          <span>
            NFT minted!{" "}
            <a href={solscanAddress(mint)} target="_blank" rel="noreferrer" onClick={() => toast.dismiss(t.id)}>
              View on Solscan ↗
            </a>
          </span>
        ),
        { id: toastId, duration: 8000 }
      );

      // Reset
      setName("");
      setDescription("");
      setCollection("");
      setRoyaltyPct(5);
      setFile(null);
      setPreview(null);
    } catch (e) {
      toast.error((e as Error).message || "Mint failed", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 560 }}>
      <div className="field">
        <label>NFT Name (max 32)</label>
        <input
          className="input"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cosmic Prism #1"
        />
      </div>

      <div className="field">
        <label>Description</label>
        <textarea
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your NFT…"
        />
      </div>

      <div className="field">
        <label>Image (PNG/JPG/GIF, max 10MB)</label>
        <input
          className="input"
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ipfsToHttp(preview)} alt="preview" className="card-img" style={{ marginTop: 10, borderRadius: 10 }} />
        )}
      </div>

      <div className="field">
        <label>Collection Name</label>
        <input
          className="input"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          placeholder="Cosmic Prisms"
        />
      </div>

      <div className="field">
        <label>Royalty: {royaltyPct}%</label>
        <input
          className="input"
          type="range"
          min={0}
          max={100}
          value={royaltyPct}
          onChange={(e) => setRoyaltyPct(Number(e.target.value))}
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Minting…" : "Create NFT"}
      </button>
    </form>
  );
};
