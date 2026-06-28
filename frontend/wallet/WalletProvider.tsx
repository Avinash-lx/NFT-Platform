import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
// Import adapters from their individual packages rather than the
// `@solana/wallet-adapter-wallets` meta-package, which pulls a large dependency
// tree (Ledger, etc.) with ESM resolution issues under Next's server bundler.
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { RPC_URL } from "@/lib/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Wraps the app with Solana connection + wallet adapter context.
 *
 * Phantom and Solflare are registered explicitly. Backpack implements the
 * Wallet Standard and is auto-detected by the adapter when installed, so it
 * appears in the wallet modal without a dedicated adapter. Wallet state persists
 * across the app via this context.
 */
export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
