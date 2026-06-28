import { NextFunction, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The verified wallet address, set by `requireWalletAuth`. */
      wallet?: string;
    }
  }
}

/**
 * Build the canonical message a client must sign to authenticate. Including a
 * timestamp lets the server reject stale signatures (replay protection).
 */
export function buildAuthMessage(wallet: string, timestamp: number): string {
  return `PRISM authentication\nwallet: ${wallet}\nts: ${timestamp}`;
}

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify a wallet signature provided via headers:
 *   x-wallet:    base58 public key
 *   x-signature: base58 signature of the auth message
 *   x-timestamp: unix ms used to build the signed message
 *
 * On success, attaches `req.wallet`.
 */
export function requireWalletAuth(req: Request, res: Response, next: NextFunction): void {
  const wallet = req.header("x-wallet");
  const signature = req.header("x-signature");
  const timestampRaw = req.header("x-timestamp");

  if (!wallet || !signature || !timestampRaw) {
    res.status(401).json({ error: "Missing wallet auth headers" });
    return;
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (Number.isNaN(timestamp) || Math.abs(Date.now() - timestamp) > MAX_SIGNATURE_AGE_MS) {
    res.status(401).json({ error: "Signature expired or invalid timestamp" });
    return;
  }

  try {
    const pubkey = new PublicKey(wallet);
    const message = new TextEncoder().encode(buildAuthMessage(wallet, timestamp));
    const valid = nacl.sign.detached.verify(
      message,
      bs58.decode(signature),
      pubkey.toBytes()
    );
    if (!valid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
    req.wallet = wallet;
    next();
  } catch {
    res.status(401).json({ error: "Invalid wallet or signature encoding" });
  }
}
