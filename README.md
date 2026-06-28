# PRISM — Solana NFT Rewards Marketplace

PRISM is a decentralized NFT marketplace on the **Solana** blockchain. Users can
connect wallets, mint / buy / sell NFTs, earn loyalty reward points, and receive
SOL cashback.

> This repository is a monorepo containing the on-chain Anchor programs, a
> Next.js frontend, and a Node.js + Express backend.

## Tech Stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Frontend         | React + Next.js (TypeScript)                            |
| Wallet           | Solana Wallet Adapter (Phantom, Solflare, Backpack)     |
| Blockchain       | Solana (Devnet for dev, Mainnet-Beta for production)    |
| Smart Contracts  | Rust + Anchor Framework                                 |
| NFT Standard     | Metaplex Token Metadata                                 |
| Storage          | IPFS via NFT.Storage / Arweave via Bundlr               |
| Backend          | Node.js + Express                                       |
| Database         | PostgreSQL (primary) + Redis (cache)                    |

## Repository Layout

```
NFT-Platform/
├── frontend/        # Next.js (TypeScript) app
├── backend/         # Node.js + Express API
└── programs/        # Anchor workspace (Rust smart contracts)
    ├── marketplace_program/
    ├── rewards_program/
    ├── escrow_program/
    ├── cashback_program/
    ├── nft_program/
    └── royalty_program/
```

## Quick Start

### 1. Smart contracts (Anchor)

```bash
cd programs
anchor build
anchor test          # runs against a local validator
anchor deploy --provider.cluster devnet
```

After deploy, copy the printed program IDs into the relevant `.env` files. The
frontend talks to the marketplace program through an Anchor client
(`frontend/services/marketplace.ts`) using the IDL at
`frontend/idl/marketplace_program.ts`. That IDL is hand-generated to mirror the
Rust program with correct discriminators; once you run `anchor build`, replace it
with the generated `target/idl/marketplace_program.json` (identical shape).

On-chain trading is wired end to end: listing, buying, and cancelling each send
the corresponding Anchor instruction (`list_nft` / `buy_nft` / `cancel_listing`)
first, then record the result in the backend. These actions require
`NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID` to point at the deployed program.

### 2. Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL, REDIS_URL, etc.
npm install
npx prisma migrate dev        # create database schema
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local    # fill in RPC + program IDs
npm install
npm run dev                   # http://localhost:3000
```

## Environment Variables

See `.env.example` at the repo root and inside `frontend/` and `backend/`.

## Loyalty Tiers

| Tier    | Points        | Marketplace fee | Benefits                    |
| ------- | ------------- | --------------- | --------------------------- |
| Bronze  | 0 – 499       | 2.5%            | Standard                    |
| Silver  | 500 – 1,999   | 2.0%            | Early access                |
| Gold    | 2,000 – 4,999 | 1.5%            | Exclusive drops             |
| Diamond | 5,000+        | 1.0%            | Cashback eligible           |

Reward points: `purchase amount (SOL) × 10`.

## Cashback

Eligible when: Diamond tier **or** active promotion, NFT held ≥ 7 days, and not
already claimed for that NFT. Cashback = 5% of purchase price, paid from the
treasury wallet.

## Build Order

1. Anchor workspace → write & test `marketplace_program` on devnet
2. Next.js app + Wallet Adapter setup
3. Metaplex mint flow (Create NFT page)
4. Marketplace page (list, buy, filter)
5. Rewards engine (backend logic + points DB)
6. Cashback module
7. Dashboard charts
8. `rewards_program` + `cashback_program` on-chain

## License

MIT
