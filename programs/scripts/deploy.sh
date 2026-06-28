#!/usr/bin/env bash
#
# PRISM program deployment.
#
# Builds and deploys all Anchor programs to a cluster, syncs the on-chain
# program IDs back into declare_id!/Anchor.toml, and writes the public program
# IDs into the app .env files.
#
# Usage:
#   ./scripts/deploy.sh devnet
#   ./scripts/deploy.sh mainnet-beta
#   ./scripts/deploy.sh localnet
#
# Env:
#   DEPLOYER_KEYPAIR_PATH   Path to the deployer/upgrade-authority keypair JSON
#                           (default: ~/.config/solana/id.json; created for
#                           devnet/localnet if missing).
#   AIRDROP_SOL             Devnet only: SOL to airdrop to the deployer (default 4).
#
# Run from the Anchor workspace root (the `programs/` directory).
set -euo pipefail

CLUSTER="${1:-devnet}"
KEYPAIR="${DEPLOYER_KEYPAIR_PATH:-$HOME/.config/solana/id.json}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # programs/
REPO="$(cd "$HERE/.." && pwd)"
cd "$HERE"

case "$CLUSTER" in
  devnet)        RPC_URL="https://api.devnet.solana.com" ;;
  mainnet|mainnet-beta) CLUSTER="mainnet"; RPC_URL="https://api.mainnet-beta.solana.com" ;;
  localnet|localhost)   CLUSTER="localnet"; RPC_URL="http://127.0.0.1:8899" ;;
  *) echo "Unknown cluster: $CLUSTER (use devnet|mainnet-beta|localnet)" >&2; exit 1 ;;
esac

# ── Prerequisites ─────────────────────────────────────────────────────────
for bin in solana anchor; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    cat >&2 <<EOF
ERROR: '$bin' is not installed.

Install the Solana + Anchor toolchain first:
  sh -c "\$(curl -sSfL https://release.anza.xyz/stable/install)"
  cargo install --git https://github.com/coral-xyz/anchor avm --force
  avm install 0.30.1 && avm use 0.30.1
EOF
    exit 1
  fi
done

echo "==> Cluster: $CLUSTER ($RPC_URL)"
echo "==> Deployer keypair: $KEYPAIR"

# ── Deployer keypair ──────────────────────────────────────────────────────
if [ ! -f "$KEYPAIR" ]; then
  if [ "$CLUSTER" = "mainnet" ]; then
    echo "ERROR: mainnet requires a funded keypair at $KEYPAIR" >&2
    exit 1
  fi
  echo "==> Generating a new deployer keypair"
  mkdir -p "$(dirname "$KEYPAIR")"
  solana-keygen new --no-bip39-passphrase -s -o "$KEYPAIR"
fi

solana config set --url "$RPC_URL" --keypair "$KEYPAIR" >/dev/null
DEPLOYER_PUBKEY="$(solana address -k "$KEYPAIR")"
echo "==> Deployer address: $DEPLOYER_PUBKEY"

# ── Funding ───────────────────────────────────────────────────────────────
if [ "$CLUSTER" = "devnet" ]; then
  TARGET_SOL="${AIRDROP_SOL:-4}"
  echo "==> Requesting devnet airdrop (target ${TARGET_SOL} SOL)"
  for _ in 1 2 3 4; do
    BAL="$(solana balance -k "$KEYPAIR" | awk '{print $1}')"
    awk "BEGIN{exit !($BAL >= $TARGET_SOL)}" && break
    solana airdrop 2 "$DEPLOYER_PUBKEY" || true
    sleep 3
  done
fi

BALANCE="$(solana balance -k "$KEYPAIR" | awk '{print $1}')"
echo "==> Deployer balance: ${BALANCE} SOL"
if awk "BEGIN{exit !($BALANCE < 2)}"; then
  echo "WARNING: balance < 2 SOL — deploying all programs may fail. Fund $DEPLOYER_PUBKEY." >&2
  [ "$CLUSTER" = "mainnet" ] && { echo "Aborting mainnet deploy with insufficient funds." >&2; exit 1; }
fi

# ── Build, sync program IDs, rebuild, deploy ──────────────────────────────
echo "==> anchor build (generate program keypairs)"
anchor build

echo "==> anchor keys sync (write declare_id! + Anchor.toml from keypairs)"
anchor keys sync

echo "==> anchor build (with synced IDs)"
anchor build

echo "==> anchor deploy --provider.cluster $CLUSTER"
anchor deploy --provider.cluster "$CLUSTER"

# ── Collect program IDs ───────────────────────────────────────────────────
echo "==> Deployed program IDs:"
anchor keys list

get_id() { anchor keys list | awk -v n="$1" '$1==n":"{print $2}'; }
MARKETPLACE_ID="$(get_id marketplace_program)"
REWARDS_ID="$(get_id rewards_program)"
CASHBACK_ID="$(get_id cashback_program)"
ESCROW_ID="$(get_id escrow_program)"
NFT_ID="$(get_id nft_program)"
ROYALTY_ID="$(get_id royalty_program)"

# ── Write program IDs into env files (upsert) ─────────────────────────────
upsert() { # upsert <file> <KEY> <VALUE>
  local file="$1" key="$2" val="$3"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$file" && rm -f "$file.bak"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

write_public_ids() {
  local file="$1"
  upsert "$file" NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID "$MARKETPLACE_ID"
  upsert "$file" NEXT_PUBLIC_REWARDS_PROGRAM_ID "$REWARDS_ID"
  upsert "$file" NEXT_PUBLIC_CASHBACK_PROGRAM_ID "$CASHBACK_ID"
  upsert "$file" NEXT_PUBLIC_ESCROW_PROGRAM_ID "$ESCROW_ID"
  upsert "$file" NEXT_PUBLIC_NFT_PROGRAM_ID "$NFT_ID"
  upsert "$file" NEXT_PUBLIC_ROYALTY_PROGRAM_ID "$ROYALTY_ID"
}

write_public_ids "$REPO/frontend/.env.local"
write_public_ids "$REPO/backend/.env"
write_public_ids "$REPO/.env"

echo
echo "==> Program IDs written to frontend/.env.local, backend/.env, .env"
echo "==> Next: initialize the marketplace config (treasury + fee):"
echo "    ANCHOR_PROVIDER_URL=$RPC_URL ANCHOR_WALLET=$KEYPAIR \\"
echo "      TREASURY_PUBKEY=<your_treasury> MARKETPLACE_FEE_BPS=250 \\"
echo "      npx ts-node scripts/init-marketplace.ts"
