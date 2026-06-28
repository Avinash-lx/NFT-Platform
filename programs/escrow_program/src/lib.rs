//! PRISM escrow program.
//!
//! A standalone escrow vault that holds a single NFT during a listing. The
//! marketplace program performs settlement inline, but this program is exposed
//! for flows that want a dedicated escrow authority.
//!
//! PDA seeds: `[b"escrow", seller.key, mint.key]`.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

declare_id!("ESC1111111111111111111111111111111111111111");

#[program]
pub mod escrow_program {
    use super::*;

    /// Deposit an NFT into a fresh escrow vault owned by the escrow PDA.
    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
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

        let escrow = &mut ctx.accounts.escrow;
        escrow.seller = ctx.accounts.seller.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.bump = ctx.bumps.escrow;
        Ok(())
    }

    /// Withdraw the NFT back to the seller and close the escrow.
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let seller_key = ctx.accounts.seller.key();
        let mint_key = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"escrow",
            seller_key.as_ref(),
            mint_key.as_ref(),
            &[ctx.accounts.escrow.bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
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
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer_seeds,
        ))?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = seller_token_account.mint == mint.key(),
        constraint = seller_token_account.owner == seller.key(),
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = seller,
        space = 8 + Escrow::SIZE,
        seeds = [b"escrow", seller.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        init,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        close = seller,
        seeds = [b"escrow", seller.key().as_ref(), mint.key().as_ref()],
        bump = escrow.bump,
        has_one = seller,
        has_one = mint,
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut, constraint = seller_token_account.owner == seller.key())]
    pub seller_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Escrow {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
}

impl Escrow {
    pub const SIZE: usize = 32 + 32 + 1;
}
