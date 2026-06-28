import bs58 from "bs58";
import { API_URL } from "@/lib/constants";

export interface AuthSigner {
  wallet: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

/** Build the signed auth headers expected by protected backend routes. */
export async function buildAuthHeaders(signer: AuthSigner): Promise<Record<string, string>> {
  const timestamp = Date.now();
  const message = `PRISM authentication\nwallet: ${signer.wallet}\nts: ${timestamp}`;
  const signature = await signer.signMessage(new TextEncoder().encode(message));
  return {
    "x-wallet": signer.wallet,
    "x-signature": bs58.encode(signature),
    "x-timestamp": String(timestamp),
  };
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: AuthSigner } = {}
): Promise<T> {
  const { auth, headers, ...rest } = options;
  const authHeaders = auth ? await buildAuthHeaders(auth) : {};
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ─── NFTs ─────────────────────────────────────────────────────────────────
export const api = {
  createNft: (
    body: {
      mint: string;
      name: string;
      description?: string;
      imageUri: string;
      metadataUri: string;
      collection?: string;
      royaltyBps: number;
      wallet: string;
    },
    auth: AuthSigner
  ) => request("/nfts", { method: "POST", body: JSON.stringify(body), auth }),

  getNft: (mint: string) => request(`/nfts/${mint}`),
  getNftsByOwner: (owner: string) => request(`/nfts?owner=${owner}`),

  // ─── Marketplace ──────────────────────────────────────────────────────────
  getListings: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]
    ).toString();
    return request(`/marketplace${qs ? `?${qs}` : ""}`);
  },

  createListing: (body: { mint: string; priceSol: number; wallet: string }, auth: AuthSigner) =>
    request("/marketplace/listings", { method: "POST", body: JSON.stringify(body), auth }),

  cancelListing: (id: string, wallet: string, auth: AuthSigner) =>
    request(`/marketplace/listings/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ wallet }),
      auth,
    }),

  buyNft: (
    body: { listingId: string; buyerWallet: string; signature?: string },
    auth: AuthSigner
  ) => request("/marketplace/buy", { method: "POST", body: JSON.stringify(body), auth }),

  // ─── Rewards ──────────────────────────────────────────────────────────────
  getRewards: (wallet: string) => request(`/rewards/${wallet}`),
  getLeaderboard: () => request("/rewards"),

  // ─── Cashback ─────────────────────────────────────────────────────────────
  checkCashback: (purchaseId: string, promotion = false) =>
    request(`/cashback/eligibility/${purchaseId}?promotion=${promotion}`),

  requestCashback: (
    body: { purchaseId: string; wallet: string; promotionActive?: boolean },
    auth: AuthSigner
  ) => request("/cashback/request", { method: "POST", body: JSON.stringify(body), auth }),

  // ─── Dashboard ──────────────────────────────────────────────────────────
  getDashboard: (wallet: string) => request(`/dashboard/${wallet}`),
};
