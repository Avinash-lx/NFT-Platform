import { FC, useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress, formatSol } from "@/lib/format";

// The adapter's modal button touches `window`, so load it client-side only.
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

/**
 * Wallet connect button. When connected, also surfaces the truncated address
 * (with copy) and the live SOL balance.
 */
export const WalletButton: FC = () => {
  const { address, balance, connected } = useWallet();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="row">
      {connected && address && (
        <button className="badge" onClick={copy} title="Copy address">
          {truncateAddress(address)} {copied ? "✓" : "⧉"}
        </button>
      )}
      {connected && balance !== null && (
        <span className="badge">{formatSol(balance)}</span>
      )}
      <WalletMultiButton />
    </div>
  );
};
