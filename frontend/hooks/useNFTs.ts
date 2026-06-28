import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

export interface NftDto {
  id: string;
  mint: string;
  name: string;
  description?: string;
  imageUri: string;
  metadataUri: string;
  collection?: string;
  royaltyBps: number;
  ownerWallet: string;
  listings?: { id: string; priceLamports: string; status: string }[];
}

/** Load the NFTs owned by a wallet from the backend (portfolio view). */
export function useNFTs(owner: string | null) {
  const [nfts, setNfts] = useState<NftDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!owner) {
      setNfts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setNfts((await api.getNftsByOwner(owner)) as NftDto[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { nfts, loading, error, refresh };
}
