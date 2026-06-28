// AUTO-GENERATED Anchor 0.30 IDL for marketplace_program.
//
// Hand-generated to mirror programs/marketplace_program/src/lib.rs with correct
// SHA256 instruction/account discriminators. Replace with the JSON emitted by
// `anchor build` (target/idl/marketplace_program.json) once the program is
// compiled — the shape is identical.
//
// The program address is overridden at runtime from
// NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID.

export type MarketplaceProgram = typeof IDL;

export const IDL = {
  "address": "MKT1111111111111111111111111111111111111111",
  "metadata": {
    "name": "marketplace_program",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "initialize_marketplace",
      "discriminator": [
        47,
        81,
        64,
        0,
        96,
        56,
        105,
        7
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury"
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "fee_bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "update_fee",
      "discriminator": [
        232,
        253,
        195,
        247,
        148,
        212,
        73,
        222
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "fee_bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "list_nft",
      "discriminator": [
        88,
        221,
        93,
        166,
        63,
        220,
        106,
        232
      ],
      "accounts": [
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "seller_token_account",
          "writable": true
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "escrow_token_account",
          "writable": true
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program"
        },
        {
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "price",
          "type": "u64"
        }
      ]
    },
    {
      "name": "buy_nft",
      "discriminator": [
        96,
        0,
        28,
        190,
        49,
        107,
        83,
        222
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "seller",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "config"
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "escrow_token_account",
          "writable": true
        },
        {
          "name": "buyer_token_account",
          "writable": true
        },
        {
          "name": "rewards_config"
        },
        {
          "name": "reward_account",
          "writable": true
        },
        {
          "name": "rewards_authority"
        },
        {
          "name": "rewards_program"
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program"
        },
        {
          "name": "system_program"
        }
      ],
      "args": []
    },
    {
      "name": "cancel_listing",
      "discriminator": [
        41,
        183,
        50,
        232,
        230,
        233,
        157,
        70
      ],
      "accounts": [
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "listing",
          "writable": true
        },
        {
          "name": "escrow_token_account",
          "writable": true
        },
        {
          "name": "seller_token_account",
          "writable": true
        },
        {
          "name": "token_program"
        },
        {
          "name": "system_program"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "MarketplaceConfig",
      "discriminator": [
        169,
        22,
        247,
        131,
        182,
        200,
        81,
        124
      ]
    },
    {
      "name": "Listing",
      "discriminator": [
        218,
        32,
        50,
        73,
        43,
        134,
        26,
        58
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "FeeTooHigh",
      "msg": "Fee exceeds the maximum allowed basis points"
    },
    {
      "code": 6001,
      "name": "InvalidPrice",
      "msg": "Listing price must be greater than zero"
    },
    {
      "code": 6002,
      "name": "NotAnNft",
      "msg": "Token account does not hold exactly one token"
    },
    {
      "code": 6003,
      "name": "MintMismatch",
      "msg": "Token account mint does not match the listing mint"
    },
    {
      "code": 6004,
      "name": "Unauthorized",
      "msg": "Signer is not authorized for this action"
    },
    {
      "code": 6005,
      "name": "InvalidTreasury",
      "msg": "Provided treasury does not match the marketplace config"
    },
    {
      "code": 6006,
      "name": "MathOverflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "MarketplaceConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "fee_bps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Listing",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "created_at",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
} as const;
