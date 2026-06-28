import { PublicKey } from "@solana/web3.js";
import { connection } from "./solana";
import { PROGRAM_IDS } from "@/lib/constants";
import { lamportsToSol } from "@/lib/format";

/**
 * Direct on-chain reads of reward + cashback state, decoded from raw account
 * data (no Anchor client needed). The dashboard prefers these over the backend
 * mirror when the programs are deployed.
 *
 * Account layouts (Anchor: 8-byte discriminator first):
 *   RewardAccount  : disc(8) user(32) points(u64) bump(1)
 *   CashbackClaim  : disc(8) user(32) mint(32) amount(u64) claimed_at(i64) bump(1)
 */

export type TierName = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";

interface TierInfo {
  tier: TierName;
  min: number;
  feeBps: number;
  cashbackEligible: boolean;
  benefits: string[];
}

const TIERS: TierInfo[] = [
  { tier: "BRONZE", min: 0, feeBps: 250, cashbackEligible: false, benefits: ["Standard 2.5% fee"] },
  { tier: "SILVER", min: 500, feeBps: 200, cashbackEligible: false, benefits: ["2.0% fee", "Early access"] },
  { tier: "GOLD", min: 2000, feeBps: 150, cashbackEligible: false, benefits: ["1.5% fee", "Exclusive drops"] },
  { tier: "DIAMOND", min: 5000, feeBps: 100, cashbackEligible: true, benefits: ["1.0% fee", "Cashback eligible"] },
];

export function tierForPoints(points: number): TierInfo {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[0];
}

export function nextTierProgress(points: number) {
  const current = tierForPoints(points);
  const idx = TIERS.findIndex((t) => t.tier === current.tier);
  if (idx >= TIERS.length - 1) return null;
  const next = TIERS[idx + 1];
  const span = next.min - current.min;
  return {
    next: next.tier,
    pointsToNext: Math.max(0, next.min - points),
    progressPct: span > 0 ? Math.min(100, Math.round(((points - current.min) / span) * 100)) : 100,
  };
}

function rewardsProgramId(): PublicKey | null {
  const id = PROGRAM_IDS.rewards;
  if (!id || id.startsWith("RWD1111")) return null;
  return new PublicKey(id);
}

function cashbackProgramId(): PublicKey | null {
  const id = PROGRAM_IDS.cashback;
  if (!id || id.startsWith("CSH1111")) return null;
  return new PublicKey(id);
}

/** Whether the rewards program is deployed (on-chain reads are possible). */
export function onchainAvailable(): boolean {
  return rewardsProgramId() !== null;
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Read a wallet's lifetime loyalty points from its reward account PDA. */
export async function getRewardPoints(user: PublicKey): Promise<number> {
  const program = rewardsProgramId();
  if (!program) return 0;
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("rewards"), user.toBuffer()],
    program
  );
  const info = await connection.getAccountInfo(pda);
  if (!info) return 0; // no purchases yet
  // points u64 at offset 8 (disc) + 32 (user) = 40
  return Number(dataView(info.data).getBigUint64(40, true));
}

export interface OnchainCashbackClaim {
  mint: string;
  amountSol: number;
  claimedAt: number;
}

/** Read all cashback claims paid to a wallet from the cashback program. */
export async function getCashbackClaims(user: PublicKey): Promise<OnchainCashbackClaim[]> {
  const program = cashbackProgramId();
  if (!program) return [];
  // Filter by `user` field at offset 8 (after the discriminator).
  const accounts = await connection.getProgramAccounts(program, {
    filters: [{ memcmp: { offset: 8, bytes: user.toBase58() } }],
  });
  return accounts.map(({ account }) => {
    const data = account.data;
    const dv = dataView(data);
    const mint = new PublicKey(data.subarray(8 + 32, 8 + 32 + 32)).toBase58();
    const amount = dv.getBigUint64(8 + 32 + 32, true); // after disc+user+mint
    const claimedAt = dv.getBigInt64(8 + 32 + 32 + 8, true);
    return { mint, amountSol: lamportsToSol(amount), claimedAt: Number(claimedAt) };
  });
}
