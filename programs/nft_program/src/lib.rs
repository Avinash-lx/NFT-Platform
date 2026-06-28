//! PRISM NFT registry program.
//!
//! Minting itself is handled client-side via the Metaplex Token Metadata
//! program. This program keeps a lightweight on-chain registry entry per mint so
//! that other PRISM programs (marketplace, royalty) can resolve the original
//! creator, collection, and royalty configuration without a metadata lookup.
//!
//! PDA seeds: `[b"nft", mint.key]`.

use anchor_lang::prelude::*;

declare_id!("NFT1111111111111111111111111111111111111111");

const MAX_NAME_LEN: usize = 32;
const MAX_COLLECTION_LEN: usize = 64;

#[program]
pub mod nft_program {
    use super::*;

    /// Register a freshly minted NFT.
    pub fn register_nft(
        ctx: Context<RegisterNft>,
        name: String,
        collection: String,
        royalty_bps: u16,
    ) -> Result<()> {
        require!(name.len() <= MAX_NAME_LEN, NftError::NameTooLong);
        require!(
            collection.len() <= MAX_COLLECTION_LEN,
            NftError::CollectionTooLong
        );
        require!(royalty_bps <= 10_000, NftError::InvalidRoyalty);

        let record = &mut ctx.accounts.nft_record;
        record.mint = ctx.accounts.mint.key();
        record.creator = ctx.accounts.creator.key();
        record.name = name;
        record.collection = collection;
        record.royalty_bps = royalty_bps;
        record.created_at = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.nft_record;

        emit!(NftRegistered {
            mint: record.mint,
            creator: record.creator,
            royalty_bps,
        });
        Ok(())
    }
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

#[account]
pub struct NftRecord {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub collection: String,
    pub royalty_bps: u16,
    pub created_at: i64,
    pub bump: u8,
}

impl NftRecord {
    // 4-byte length prefix for each String.
    pub const SIZE: usize = 32 + 32 + (4 + MAX_NAME_LEN) + (4 + MAX_COLLECTION_LEN) + 2 + 8 + 1;
}

#[event]
pub struct NftRegistered {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub royalty_bps: u16,
}

#[error_code]
pub enum NftError {
    #[msg("NFT name exceeds 32 characters")]
    NameTooLong,
    #[msg("Collection name exceeds 64 characters")]
    CollectionTooLong,
    #[msg("Royalty basis points must be <= 10000")]
    InvalidRoyalty,
}
