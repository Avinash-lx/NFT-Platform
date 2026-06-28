import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

export interface ListingDto {
  id: string;
  priceLamports: string;
  priceSol: number;
  status: string;
  createdAt: string;
  seller: { wallet: string };
  nft: {
    id: string;
    mint: string;
    name: string;
    imageUri: string;
    collection?: string;
    ownerWallet: string;
  };
}

export interface MarketplaceFilters {
  search?: string;
  collection?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "latest" | "price_asc" | "price_desc";
}

/** Fetch and filter marketplace listings. */
export function useMarketplace(filters: MarketplaceFilters = {}) {
  const [listings, setListings] = useState<ListingDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { search, collection, minPrice, maxPrice, sort } = filters;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await api.getListings({
        search,
        collection,
        minPrice,
        maxPrice,
        sort,
      })) as ListingDto[];
      setListings(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, collection, minPrice, maxPrice, sort]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { listings, loading, error, refresh };
}
