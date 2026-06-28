//! PRISM marketplace program.
//!
//! Instructions:
//! - `initialize_marketplace(fee_bps)` → one-time config (authority + treasury + fee)
//! - `list_nft(price)`                 → lock NFT in an escrow PDA token account
//! - `buy_nft()`                       → transfer SOL (minus fee) + NFT to buyer
//! - `cancel_listing()`                → return NFT to the seller
//!
//! All SOL amounts are expressed in **lamports**.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

declare_id!("MKT1111111111111111111111111111111111111111");

/// Hard cap on the marketplace fee to protect users (10%).
const MAX_FEE_BPS: u16 = 1_000;
/// Basis-point denominator.
const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod marketplace_program {
    use super::*;

    /// One-time initialization of the global marketplace config.
    pub fn initialize_marketplace(ctx: Context<InitializeMarketplace>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, MarketplaceError::FeeTooHigh);

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.config;

        emit!(MarketplaceInitialized {
            authority: config.authority,
            treasury: config.treasury,
            fee_bps,
        });
        Ok(())
    }

    /// Update the marketplace fee (authority only).
    pub fn update_fee(ctx: Context<UpdateConfig>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, MarketplaceError::FeeTooHigh);
        ctx.accounts.config.fee_bps = fee_bps;
        Ok(())
    }

    /// List an owned NFT for sale. Moves the single NFT token into an escrow
    /// token account owned by the listing PDA.
    pub fn list_nft(ctx: Context<ListNft>, price: u64) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);

        // Move the NFT (amount = 1) from the seller into the escrow ATA.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            1,
        )?;

        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.mint = ctx.accounts.mint.key();
        listing.price = price;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.bump = ctx.bumps.listing;

        emit!(NftListed {
            seller: listing.seller,
            mint: listing.mint,
            price,
        });
        Ok(())
    }

    /// Purchase a listed NFT. The buyer pays `price` lamports; the marketplace
    /// fee is routed to the treasury and the remainder to the seller. The NFT is
    /// released from escrow to the buyer and the listing is closed.
    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        let price = listing.price;
        let fee = price
            .checked_mul(ctx.accounts.config.fee_bps as u64)
            .and_then(|v| v.checked_div(BPS_DENOMINATOR))
            .ok_or(MarketplaceError::MathOverflow)?;
        let seller_proceeds = price.checked_sub(fee).ok_or(MarketplaceError::MathOverflow)?;

        // Pay the seller.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
            ),
            seller_proceeds,
        )?;

        // Pay the marketplace fee to the treasury.
        if fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        // Release the NFT from escrow to the buyer, signed by the listing PDA.
        let seller_key = ctx.accounts.seller.key();
        let mint_key = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"listing",
            seller_key.as_ref(),
            mint_key.as_ref(),
            &[ctx.accounts.listing.bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.listing.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        // Close the (now empty) escrow token account, refunding rent to the seller.
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.escrow_token_account.to_account_info(),
                destination: ctx.accounts.seller.to_account_info(),
                authority: ctx.accounts.listing.to_account_info(),
            },
            signer_seeds,
        ))?;

        emit!(NftSold {
            seller: seller_key,
            buyer: ctx.accounts.buyer.key(),
            mint: mint_key,
            price,
            fee,
        });
        Ok(())
    }

    /// Cancel a listing and return the NFT to the seller.
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let seller_key = ctx.accounts.seller.key();
        let mint_key = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"listing",
            seller_key.as_ref(),
            mint_key.as_ref(),
            &[ctx.accounts.listing.bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.listing.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.escrow_token_account.to_account_info(),
                destination: ctx.accounts.seller.to_account_info(),
                authority: ctx.accounts.listing.to_account_info(),
            },
            signer_seeds,
        ))?;

        emit!(ListingCancelled {
            seller: seller_key,
            mint: mint_key,
        });
        Ok(())
    }
}

// ───────────────────────────── Accounts ────────────────────────────────

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: treasury is an arbitrary wallet that collects marketplace fees.
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + MarketplaceConfig::SIZE,
        seeds = [b"marketplace"],
        bump
    )]
    pub config: Account<'info, MarketplaceConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, address = config.authority @ MarketplaceError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"marketplace"], bump = config.bump)]
    pub config: Account<'info, MarketplaceConfig>,
}

#[derive(Accounts)]
pub struct ListNft<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = seller_token_account.mint == mint.key() @ MarketplaceError::MintMismatch,
        constraint = seller_token_account.owner == seller.key() @ MarketplaceError::Unauthorized,
        constraint = seller_token_account.amount == 1 @ MarketplaceError::NotAnNft,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = seller,
        space = 8 + Listing::SIZE,
        seeds = [b"listing", seller.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    #[account(
        init,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = listing,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: validated against `listing.seller`.
    #[account(mut, address = listing.seller @ MarketplaceError::Unauthorized)]
    pub seller: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(seeds = [b"marketplace"], bump = config.bump)]
    pub config: Account<'info, MarketplaceConfig>,
    /// CHECK: validated against `config.treasury`.
    #[account(mut, address = config.treasury @ MarketplaceError::InvalidTreasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(
        mut,
        close = seller,
        seeds = [b"listing", seller.key().as_ref(), mint.key().as_ref()],
        bump = listing.bump,
        has_one = mint @ MarketplaceError::MintMismatch,
    )]
    pub listing: Account<'info, Listing>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = listing,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        close = seller,
        seeds = [b"listing", seller.key().as_ref(), mint.key().as_ref()],
        bump = listing.bump,
        has_one = seller @ MarketplaceError::Unauthorized,
        has_one = mint @ MarketplaceError::MintMismatch,
    )]
    pub listing: Account<'info, Listing>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = listing,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = seller_token_account.mint == mint.key() @ MarketplaceError::MintMismatch,
        constraint = seller_token_account.owner == seller.key() @ MarketplaceError::Unauthorized,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ───────────────────────────── State ───────────────────────────────────

#[account]
pub struct MarketplaceConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

impl MarketplaceConfig {
    pub const SIZE: usize = 32 + 32 + 2 + 1;
}

#[account]
pub struct Listing {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price: u64,
    pub created_at: i64,
    pub bump: u8,
}

impl Listing {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 1;
}

// ───────────────────────────── Events ──────────────────────────────────

#[event]
pub struct MarketplaceInitialized {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct NftListed {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price: u64,
}

#[event]
pub struct NftSold {
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub price: u64,
    pub fee: u64,
}

#[event]
pub struct ListingCancelled {
    pub seller: Pubkey,
    pub mint: Pubkey,
}

// ───────────────────────────── Errors ──────────────────────────────────

#[error_code]
pub enum MarketplaceError {
    #[msg("Fee exceeds the maximum allowed basis points")]
    FeeTooHigh,
    #[msg("Listing price must be greater than zero")]
    InvalidPrice,
    #[msg("Token account does not hold exactly one token")]
    NotAnNft,
    #[msg("Token account mint does not match the listing mint")]
    MintMismatch,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Provided treasury does not match the marketplace config")]
    InvalidTreasury,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
