import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { isValidPublicKey } from "../lib/solana";
import { ApiError } from "../lib/http";
import { writeRateLimit } from "../middleware/rateLimit";
import { requireWalletAuth } from "../middleware/auth";

import { createNft, getNft, getNftsByOwner } from "../controllers/nftController";
import {
  buyNft,
  cancelListing,
  createListing,
  getListings,
} from "../controllers/marketplaceController";
import { getLeaderboard, getRewards } from "../controllers/rewardsController";
import { checkEligibility, requestCashback } from "../controllers/cashbackController";
import { getDashboard } from "../analytics/charts";
import { jsonSafe } from "../lib/http";

export const router = Router();

// ─── NFTs ───────────────────────────────────────────────────────────────
router.get("/nfts", asyncHandler(getNftsByOwner));
router.get("/nfts/:mint", asyncHandler(getNft));
router.post("/nfts", writeRateLimit, requireWalletAuth, asyncHandler(createNft));

// ─── Marketplace ─────────────────────────────────────────────────────────
router.get("/marketplace", asyncHandler(getListings));
router.post("/marketplace/listings", writeRateLimit, requireWalletAuth, asyncHandler(createListing));
router.post(
  "/marketplace/listings/:id/cancel",
  writeRateLimit,
  requireWalletAuth,
  asyncHandler(cancelListing)
);
router.post("/marketplace/buy", writeRateLimit, requireWalletAuth, asyncHandler(buyNft));

// ─── Rewards ──────────────────────────────────────────────────────────────
router.get("/rewards", asyncHandler(getLeaderboard));
router.get("/rewards/:wallet", asyncHandler(getRewards));

// ─── Cashback ────────────────────────────────────────────────────────────
router.get("/cashback/eligibility/:purchaseId", asyncHandler(checkEligibility));
router.post("/cashback/request", writeRateLimit, requireWalletAuth, asyncHandler(requestCashback));

// ─── Dashboard / analytics ────────────────────────────────────────────────
router.get(
  "/dashboard/:wallet",
  asyncHandler(async (req, res) => {
    if (!isValidPublicKey(req.params.wallet)) throw new ApiError(400, "Invalid wallet");
    const payload = await getDashboard(req.params.wallet);
    res.json(jsonSafe(payload));
  })
);
