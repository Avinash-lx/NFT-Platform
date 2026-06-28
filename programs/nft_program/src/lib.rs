//! PRISM NFT program.
//!
//! Mints NFTs **on-chain**: this program creates the SPL mint, mints exactly one
//! token to the creator, and issues the Metaplex Token Metadata + Master Edition
//! accounts via CPI. The frontend only uploads media/metadata to IPFS and then
//! calls `mint_nft` — the chain performs the mint, not a client-side SDK.
//!
//! It also keeps an optional lightweight on-chain registry entry per mint so
//! other PRISM programs can resolve creator/collection/royalty without a full
//! metadata lookup.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{
    create_master_edition_v3, create_metadata_accounts_v3,
    mpl_token_metadata::types::{Creator, DataV2},
    CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
};
use anchor_spl::token::{mint_to, Mint, MintTo, Token, TokenAccount};

declare_id!("NFT1111111111111111111111111111111111111111");

const MAX_NAME_LEN: usize = 32;
const MAX_SYMBOL_LEN: usize = 10;
const MAX_URI_LEN: usize = 200;
const MAX_COLLECTION_LEN: usize = 64;

#[program]
pub mod nft_program {
    use super::*;

    /// Mint a 1/1 NFT on-chain: create the mint, mint one token to the creator's
    /// ATA, then create the Token Metadata and Master Edition accounts via CPI.
    pub fn mint_nft(
        ctx: Context<MintNft>,
        name: String,
        symbol: String,
        uri: String,
        seller_fee_basis_points: u16,
    ) -> Result<()> {
        require!(!name.is_empty() && name.len() <= MAX_NAME_LEN, NftError::NameTooLong);
        require!(symbol.len() <= MAX_SYMBOL_LEN, NftError::SymbolTooLong);
        require!(uri.len() <= MAX_URI_LEN, NftError::UriTooLong);
        require!(seller_fee_basis_points <= 10_000, NftError::InvalidRoyalty);

        // Mint exactly one token to the creator (mint authority = creator).
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            1,
        )?;

        // Create the metadata account, marking the creator as a verified creator.
        let creators = vec![Creator {
            address: ctx.accounts.creator.key(),
            verified: true,
            share: 100,
        }];

        create_metadata_accounts_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    mint_authority: ctx.accounts.creator.to_account_info(),
                    payer: ctx.accounts.creator.to_account_info(),
                    update_authority: ctx.accounts.creator.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points,
                creators: Some(creators),
                collection: None,
                uses: None,
            },
            true, // is_mutable
            true, // update_authority_is_signer
            None, // collection_details
        )?;

        // Create the master edition (max_supply = 0 makes it a true 1/1 NFT and
        // moves mint/freeze authority to the edition PDA).
        create_master_edition_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.creator.to_account_info(),
                    mint_authority: ctx.accounts.creator.to_account_info(),
                    payer: ctx.accounts.creator.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            Some(0),
        )?;

        emit!(NftMinted {
            mint: ctx.accounts.mint.key(),
            creator: ctx.accounts.creator.key(),
            seller_fee_basis_points,
        });
        Ok(())
    }

    /// Optional: record a registry entry for an already-minted NFT.
    pub fn register_nft(
        ctx: Context<RegisterNft>,
        collection: String,
        royalty_bps: u16,
    ) -> Result<()> {
        require!(
            collection.len() <= MAX_COLLECTION_LEN,
            NftError::CollectionTooLong
        );
        require!(royalty_bps <= 10_000, NftError::InvalidRoyalty);

        let record = &mut ctx.accounts.nft_record;
        record.mint = ctx.accounts.mint.key();
        record.creator = ctx.accounts.creator.key();
        record.collection = collection;
        record.royalty_bps = royalty_bps;
        record.created_at = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.nft_record;
        Ok(())
    }
}

// ───────────────────────────── Accounts ────────────────────────────────

#[derive(Accounts)]
pub struct MintNft<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// New mint for the NFT (created and paid for by the creator).
    #[account(
        init,
        payer = creator,
        mint::decimals = 0,
        mint::authority = creator,
        mint::freeze_authority = creator,
    )]
    pub mint: Account<'info, Mint>,

    /// Creator's associated token account that receives the single token.
    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: Metadata PDA, created via CPI and validated by Token Metadata seeds.
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Master Edition PDA, created via CPI and validated by seeds.
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint.key().as_ref(), b"edition"],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterNft<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: the SPL mint of the NFT being registered.
    pub mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + NftRecord::SIZE,
        seeds = [b"nft", mint.key().as_ref()],
        bump
    )]
    pub nft_record: Account<'info, NftRecord>,
    pub system_program: Program<'info, System>,
}

// ───────────────────────────── State ───────────────────────────────────

#[account]
pub struct NftRecord {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub collection: String,
    pub royalty_bps: u16,
    pub created_at: i64,
    pub bump: u8,
}

impl NftRecord {
    pub const SIZE: usize = 32 + 32 + (4 + MAX_COLLECTION_LEN) + 2 + 8 + 1;
}

// ───────────────────────────── Events ──────────────────────────────────

#[event]
pub struct NftMinted {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub seller_fee_basis_points: u16,
}

// ───────────────────────────── Errors ──────────────────────────────────

#[error_code]
pub enum NftError {
    #[msg("NFT name is empty or exceeds 32 characters")]
    NameTooLong,
    #[msg("Symbol exceeds 10 characters")]
    SymbolTooLong,
    #[msg("URI exceeds 200 characters")]
    UriTooLong,
    #[msg("Collection name exceeds 64 characters")]
    CollectionTooLong,
    #[msg("Royalty basis points must be <= 10000")]
    InvalidRoyalty,
}
