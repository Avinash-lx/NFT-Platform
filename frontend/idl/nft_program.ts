// AUTO-GENERATED Anchor 0.30 IDL for nft_program.
//
// Mirrors programs/nft_program/src/lib.rs with correct SHA256 discriminators.
// Replace with target/idl/nft_program.json after `anchor build`. The program
// address is overridden at runtime from NEXT_PUBLIC_NFT_PROGRAM_ID.

export type NftProgram = typeof IDL;

export const IDL = {
  "address": "NFT1111111111111111111111111111111111111111",
  "metadata": {
    "name": "nft_program",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "mint_nft",
      "discriminator": [
        211,
        57,
        6,
        167,
        15,
        219,
        35,
        251
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "writable": true,
          "signer": true
        },
        {
          "name": "token_account",
          "writable": true
        },
        {
          "name": "metadata",
          "writable": true
        },
        {
          "name": "master_edition",
          "writable": true
        },
        {
          "name": "token_program"
        },
        {
          "name": "associated_token_program"
        },
        {
          "name": "token_metadata_program"
        },
        {
          "name": "system_program"
        },
        {
          "name": "rent"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "seller_fee_basis_points",
          "type": "u16"
        }
      ]
    },
    {
      "name": "register_nft",
      "discriminator": [
        98,
        152,
        103,
        223,
        88,
        129,
        227,
        114
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "nft_record",
          "writable": true
        },
        {
          "name": "system_program"
        }
      ],
      "args": [
        {
          "name": "collection",
          "type": "string"
        },
        {
          "name": "royalty_bps",
          "type": "u16"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "NftRecord",
      "discriminator": [
        174,
        190,
        114,
        100,
        177,
        14,
        90,
        254
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "NameTooLong",
      "msg": "NFT name is empty or exceeds 32 characters"
    },
    {
      "code": 6001,
      "name": "SymbolTooLong",
      "msg": "Symbol exceeds 10 characters"
    },
    {
      "code": 6002,
      "name": "UriTooLong",
      "msg": "URI exceeds 200 characters"
    },
    {
      "code": 6003,
      "name": "CollectionTooLong",
      "msg": "Collection name exceeds 64 characters"
    },
    {
      "code": 6004,
      "name": "InvalidRoyalty",
      "msg": "Royalty basis points must be <= 10000"
    }
  ],
  "types": [
    {
      "name": "NftRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "collection",
            "type": "string"
          },
          {
            "name": "royalty_bps",
            "type": "u16"
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
