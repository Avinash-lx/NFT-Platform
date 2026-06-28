import { NFT_STORAGE_API_KEY } from "@/lib/constants";

const NFT_STORAGE_ENDPOINT = "https://api.nft.storage/upload";

/** Convert an ipfs:// URI (or CID) to an HTTP gateway URL for display. */
export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `https://nftstorage.link/ipfs/${uri.replace("ipfs://", "")}`;
  }
  return uri;
}

async function uploadBlob(blob: Blob): Promise<string> {
  if (!NFT_STORAGE_API_KEY) {
    throw new Error("NFT.Storage API key is not configured");
  }
  const res = await fetch(NFT_STORAGE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${NFT_STORAGE_API_KEY}` },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`IPFS upload failed (${res.status})`);
  }
  const json = (await res.json()) as { value: { cid: string } };
  return `ipfs://${json.value.cid}`;
}

/** Upload an image file to IPFS, returning an ipfs:// URI. */
export async function uploadImage(file: File): Promise<string> {
  return uploadBlob(file);
}

export interface NftMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: { trait_type: string; value: string }[];
  properties?: Record<string, unknown>;
}

/** Upload a metadata JSON document to IPFS, returning an ipfs:// URI. */
export async function uploadMetadata(metadata: NftMetadata): Promise<string> {
  const blob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
  return uploadBlob(blob);
}
