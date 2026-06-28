import type { NextPage } from "next";
import { MintForm } from "@/components/MintForm";
import { useWallet } from "@/hooks/useWallet";

const CreatePage: NextPage = () => {
  const { connected } = useWallet();

  return (
    <section className="section">
      <h1>Create an NFT</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        Upload your artwork, set a royalty, and mint directly to Solana via
        Metaplex. Metadata is stored on IPFS.
      </p>
      {connected ? (
        <MintForm />
      ) : (
        <p className="muted">Connect your wallet to start minting.</p>
      )}
    </section>
  );
};

export default CreatePage;
