import { useCallback, useEffect, useState } from "react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { getBalance, getRecentTransactions, RecentTx } from "@/services/solana";
import type { AuthSigner } from "@/services/api";

/**
 * Convenience wrapper over the Solana wallet adapter that also surfaces live
 * balance, recent transactions, and an `AuthSigner` for backend auth.
 */
export function useWallet() {
  const adapter = useSolanaWallet();
  const { publicKey, connected, signMessage } = adapter;

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(false);

  const address = publicKey?.toBase58() ?? null;

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      setTransactions([]);
      return;
    }
    setLoading(true);
    try {
      const [bal, txs] = await Promise.all([
        getBalance(publicKey),
        getRecentTransactions(publicKey, 5),
      ]);
      setBalance(bal);
      setTransactions(txs);
    } catch (err) {
      // Never let an RPC hiccup (rate limits, transient network) break the
      // connected state or surface as an unhandled rejection.
      console.warn("[useWallet] balance/tx refresh failed:", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** AuthSigner for signed backend requests (null until connected + signable). */
  const authSigner: AuthSigner | null =
    address && signMessage ? { wallet: address, signMessage } : null;

  return {
    ...adapter,
    address,
    connected,
    balance,
    transactions,
    loading,
    refresh,
    authSigner,
  };
}
